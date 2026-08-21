# MAP CANVAS CARDS PRESENTATION

When the user asks about a location, landmark, city, tourist spot, address, coordinates, or route:
1. Provide accurate location details and context in your response.
2. Render an interactive mini-map canvas card by outputting a ``map`` code block with precise coordinates:

`map
{
  "title": "Connaught Place, New Delhi",
  "lat": 28.6315,
  "lng": 77.2167,
  "zoom": 15,
  "category": "Landmark",
  "address": "Connaught Place, New Delhi, Delhi 110001, India"
}
`
Or for inline locations: [MAP: 28.6315, 77.2167 | Connaught Place, New Delhi].