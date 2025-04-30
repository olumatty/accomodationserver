const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { default: axios } = require('axios');

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'OK', server: 'Bob', uptime: process.uptime() });
  });

app.get('/v1/get_accommodation', async (req, res) => {
    console.log("Accommodation Agent: Received request.");
    console.log("Accommodation Agent: HOTEL_API_KEY length (in route):", process.env.HOTEL_API_KEY ? process.env.HOTEL_API_KEY.length : 'Not set');

    try {
        const { destination, checkInDate, checkOutDate } = req.query || req.body;

        console.log("Accommodation Agent: Searching for destination:", destination);

        if (!destination || !checkInDate || !checkOutDate) {
            return res.status(400).json({ error: "destination, checkInDate, checkOutDate are required" });
        }


        // --- Add specific try...catch for the second API call ---
    
        try {
            hotelResponse = await axios({
                method: 'GET',
                url: 'https://hoteldiscoveryapi.p.rapidapi.com/api/hotels/destination/search', 
                headers: {
                    'x-rapidapi-key': process.env.HOTEL_API_KEY, 
                    'x-rapidapi-host': 'hoteldiscoveryapi.p.rapidapi.com' 
                },
                params: {
                    q: destination,
                    check_in_date: checkInDate,
                    check_out_date: checkOutDate,
                }
            })

        } catch (hotelError) {
             console.error("--- Error during TripAdvisor searchHotels API call ---");
            console.error("Accommodation Agent: Error calling searchHotels API:", hotelError.message);
            if (hotelError.response) {
                console.error("Accommodation Agent: searchHotels API Error Status:", hotelError.response.status);
                console.error("Accommodation Agent: searchHotels API Error Details:", hotelError.response.data);
            }
            // Re-throw the error
            throw hotelError;
        }
        let results = hotelResponse.data?.properties;

        if (!Array.isArray(results)) {
            console.error("Error: hotelResponse.data.data is not an array:", results);
            return res.status(500).json({
                error: "Failed to process accommodation details",
                details: "Expected hotel data to be an array but it was not.",
                apiResponse: hotelResponse.data
            });
        }


        const structuredResults = results.map((hotelData) => {
            const name = hotelData.name;
            const description = hotelData.description;
            const price = hotelData.rate_per_night?.lowest;
            const rating = hotelData.overall_rating;
            const imageUrl = hotelData.images?.[0]?.thumbnail;
            const amenities = hotelData.amenities;

            return {
                hotelName: name,
                description : description,
                price: price,
                rating: rating,
                imageUrl: imageUrl,
                amenities: amenities
            }
        });

        const topResults = structuredResults
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 4);

        // Sending the extracted accommodation data in the response
        res.status(200).json({
            agent: 'Bob',
            extractedInfo: { destination, checkInDate, checkOutDate },
            accommodation: topResults,
        });

    } catch (error) { // This is the main catch block
        console.error("--- Unhandled Error in Accommodation Agent Route ---");
        console.error("Accommodation Agent: Unexpected Error:", error.message);
        if (error.response) {
             // This part might not always be hit if the crash happens mid-axios
            console.error("Accommodation Agent: Unexpected Error API Status:", error.response.status);
            console.error("Accommodation Agent: Unexpected Error API Details:", error.response.data);
        }
        // Log the full stack trace for unhandled errors
        console.error("Accommodation Agent: Unexpected Error Stack:", error.stack);

        res.status(500).json({
            error: "An internal error occurred in the accommodation agent",
            details: error.message,
             // Include stack in details for debugging, remove for production
            stack: error.stack,
            apiError: error.response?.data || "No additional details"
        });
    }
});

app.get('/test-log', (req, res) => {
    console.log("--- TEST LOG ENDPOINT HIT ---");
    res.status(200).send("Test log received");
});


const PORT = process.env.PORT || 8002; // Use Render's PORT, 8002 as local fallback
const HOST = '0.0.0.0'; // Bind to all network interfaces

app.listen(PORT, HOST, () => {
    console.log(`Accommodation Agent server listening on ${HOST}:${PORT}`);
     console.log("Environment check:", {
        HOTEL_API_KEY: process.env.HOTEL_API_KEY ? "set" : "missing",
        PORT: process.env.PORT || "8002"
    });
});