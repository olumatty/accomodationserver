const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { default: axios } = require('axios');

dotenv.config();

const app = express();
const PORT = 8002;

app.use(express.json());
app.use(cors());

app.get('/v1/get_accommodation', async (req, res) => {
    try {
        const { destination, checkInDate, checkOutDate } = req.query || req.body;

        if (!destination || !checkInDate || !checkOutDate) {
            return res.status(400).json({ error: "destination, checkInDate, checkOutDate are required" });
        }

        // First API call to get geoId based on the destination
        const geoResponse = await axios({
            method: 'GET',
            url: 'https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation',
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': process.env.HOTEL_API_KEY,
                'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com'
            },
            params: { query: destination }
        });

        const locationData = geoResponse.data.data[0];
        const geoId = locationData?.geoId

        if (!geoId) {
            return res.status(404).json({ error: "No location found for the given destination" });
        }

        // Second API call to fetch hotels using geoId
        const hotelResponse = await axios({
            method: 'GET',
            url: 'https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels',
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': process.env.HOTEL_API_KEY,
                'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com'
            },
            params: { geoId, checkIn: checkInDate, checkOut: checkOutDate }
        });


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

    } catch (error) {
        console.error("Error fetching accommodation details", error.message);
        if (error.response) {
            console.error("API Error Details:", error.response.status, error.response.data);
        }
        res.status(500).json({
            error: "Failed to fetch accommodation details",
            details: error.message,
            apiError: error.response?.data || "No additional details"
        });
    }
});

app.listen(PORT, () => {
    console.log(`The server is running on port ${PORT}`);
});