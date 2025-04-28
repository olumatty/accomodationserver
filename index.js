const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { default: axios } = require('axios');

dotenv.config();

const app = express();
const PORT = 8002;

app.use(express.json());
app.use(cors());

pp.get('/v1/get_accommodation', async (req, res) => {
    console.log("Accommodation Agent: Received request.");
    console.log("Accommodation Agent: HOTEL_API_KEY length (in route):", process.env.HOTEL_API_KEY ? process.env.HOTEL_API_KEY.length : 'Not set');

    try {
        const { destination, checkInDate, checkOutDate } = req.query || req.body;

        console.log("Accommodation Agent: Searching for destination:", destination);

        if (!destination || !checkInDate || !checkOutDate) {
            return res.status(400).json({ error: "destination, checkInDate, checkOutDate are required" });
        }

        // --- Add specific try...catch for the first API call ---
        let geoResponse;
        try {
            console.log("Accommodation Agent: Calling TripAdvisor searchLocation API...");
             geoResponse = await axios({
                method: 'GET',
                url: 'https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation',
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Key': process.env.HOTEL_API_KEY, // Using the env variable
                    'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com'
                },
                params: { query: destination }
            });
            console.log("Accommodation Agent: Received response from searchLocation API. Status:", geoResponse.status);
            // Log part of the geoResponse data to confirm structure
            console.log("Accommodation Agent: searchLocation Response Data (first 500 chars):", JSON.stringify(geoResponse.data, null, 2).substring(0, 500));


        } catch (geoError) {
            console.error("--- Error during TripAdvisor searchLocation API call ---");
            console.error("Accommodation Agent: Error calling searchLocation API:", geoError.message);
            if (geoError.response) {
                console.error("Accommodation Agent: searchLocation API Error Status:", geoError.response.status);
                console.error("Accommodation Agent: searchLocation API Error Details:", geoError.response.data);
            }
             // Re-throw the error so the main catch block can handle the 500 response
            throw geoError;
        }
        // --- End specific try...catch ---


        const locationData = geoResponse.data.data?.[0]; // Use optional chaining defensively
        const geoId = locationData?.geoId

        console.log("Accommodation Agent: Extracted geoId:", geoId);


        if (!geoId) {
            console.error("Accommodation Agent: No geoId found for destination:", destination);
            return res.status(404).json({ error: "No location found for the given destination" });
        }

        // --- Add specific try...catch for the second API call ---
        let hotelResponse;
        try {
            console.log("Accommodation Agent: Calling TripAdvisor searchHotels API...");
             hotelResponse = await axios({
                method: 'GET',
                url: 'https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels',
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Key': process.env.HOTEL_API_KEY,
                    'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com'
                },
                params: { geoId, checkIn: checkInDate, checkOut: checkOutDate }
            });
            console.log("Accommodation Agent: Received response from searchHotels API. Status:", hotelResponse.status);
             // Log part of the hotelResponse data
            console.log("Accommodation Agent: searchHotels Response Data (first 500 chars):", JSON.stringify(hotelResponse.data, null, 2).substring(0, 500));


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
        // --- End specific try...catch ---


        let results = hotelResponse.data?.data?.data;

        if (!Array.isArray(results)) {
            console.error("Error: hotelResponse.data.data is not an array:", results);
            return res.status(500).json({
                error: "Failed to process accommodation details",
                details: "Expected hotel data to be an array but it was not.",
                apiResponse: hotelResponse.data
            });
        }


        const structuredResults = results.map((data) => {
            const photoTemplate = data.cardPhotos?.[0]?.sizes?.urlTemplate;
            let imageUrl = null; // Initialize imageUrl as null

            if (photoTemplate) {
                imageUrl = photoTemplate.replace('{w}', '400').replace('{h}', '300');
            }

            return {
                hotelName: data.title.replace(/^\d+\.\s*/, '').trimStart(),
                description : data.secondaryInfo,
                price: data.commerceInfo?.priceForDisplay?.text,
                provider: data.provider,
                rating: data.bubbleRating?.rating,
                detailsPageUrl: data.detailPageUrl,
                externalUrl: data.commerceInfo?.externalUrl,
                imageUrl: imageUrl,
            };
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


app.listen(PORT, () => {
    console.log(`The server is running on port ${PORT}`);
});