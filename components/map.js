class Map {
    constructor(data) {
        this.data = data;
        this.width = 648;
        this.height = 850;
        this.map = L.map('map-view').setView([37.547, 127.0406], 14); // Center on Seongdong-gu, Seoul

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(this.map);

        this.pathCounts = this.calculatePathCounts();

        // Calculate top 10% threshold
        const counts = Object.values(this.pathCounts).sort((a, b) => a - b);
        const top10PercentThreshold = d3.quantile(counts, 0.8);

        // Filter paths for top 10%
        this.topPaths = Object.entries(this.pathCounts)
            .filter(([key, count]) => count >= top10PercentThreshold)
            .map(([key, count]) => ({ key, count }));

        // Sort the topPaths by count
        this.topPaths.sort((a, b) => a.count - b.count);

        // Define color scale for 10 equal parts
        this.colorScale = d3.scaleQuantize()
            .domain([0, this.topPaths.length])
            .range(d3.range(10).map(i => d3.interpolateReds(i / 9)));

        // Define thickness scale for 10 equal parts
        this.thicknessScale = d3.scaleQuantize()
            .domain([0, this.topPaths.length])
            .range(d3.range(10).map(i => 1 + i / 2)); // 1 to 5
    }

    calculatePathCounts() {
        const pathCounts = {};
        this.data.forEach(d => {
            const start = `${d.RENT_LAT},${d.RENT_LON}`;
            const end = `${d.RTN_LAT},${d.RTN_LON}`;
            const pathKey = [start, end].sort().join("_");

            if (!pathCounts[pathKey]) {
                pathCounts[pathKey] = 0;
            }
            pathCounts[pathKey]++;
        });
        return pathCounts;
    }

    initialize() {
        // Draw top 10% paths
        this.topPaths.forEach((path, index) => {
            const { key, count } = path;
            const [start, end] = key.split("_").map(d => d.split(",").map(Number));
            const weight = this.thicknessScale(index);
            const color = this.colorScale(index);

            L.polyline([start, end], {
                color: color,
                weight: weight,
                opacity: 0.7
            }).addTo(this.map);
        });

        // Draw markers last to be on top
        Object.keys(this.pathCounts).forEach(pathKey => {
            const [start, end] = pathKey.split("_").map(d => d.split(",").map(Number));

            L.circleMarker(start, {
                color: 'red',
                radius: 3,
                opacity: 1,
                fillOpacity: 1
            }).addTo(this.map);

            L.circleMarker(end, {
                color: 'red',
                radius: 3,
                opacity: 1,
                fillOpacity: 1
            }).addTo(this.map);
        });
    }
}
