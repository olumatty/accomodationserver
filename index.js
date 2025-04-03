const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { default: axios } = require('axios');

dotenv.config();

const app = express();
const PORT = 8002;

app.use(express.json());
app.use(cors());

app.get('/get_accommodation', async (req, res) => {
    try {
        const destination = req.query.destination || req.body.destination; 

        if (!destination) {
            return res.status(400).json({ error: "Destination is required" });
        }

        const options = {
            method: 'GET',
            url: 'https://real-time-tripadvisor-scraper-api.p.rapidapi.com/tripadvisor_hotels_search_v2', 
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': process.env.HOTEL_API_KEY,
                'X-RapidAPI-Host': 'real-time-tripadvisor-scraper-api.p.rapidapi.com'
            },
            params: { location: destination } 
        };

        const response = await axios.request(options);

        if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
            return res.status(404).json({ 
                error: "No accommodation data found", 
                apiResponse: response.data 
            });
        }

        const results = response.data.data;

        const structuredResults = results.map((hotel) => ({
            name: hotel.name || "N/A",
            city: hotel.address?.city || "N/A",
            fullAddress: hotel.address?.fullAddress || "N/A",
            amenities: hotel.amenities || [],
            phone: hotel.contacts?.phone || "N/A",
            website: hotel.contacts?.website || "N/A",
            link: hotel.contact?.link || "N/A",
            price: {
                min: hotel.price?.priceMin || "N/A",
                max: hotel.price?.priceMax || "N/A",
                currency: hotel.price?.currency || "USD"
            },
            rating: hotel.rating?.total || "N/A",
        }));

        res.status(200).json({
            agent: 'Bob',
            extractedInfo: destination,
            accommodation: structuredResults
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
