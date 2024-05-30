class Map {
    constructor(data) {
        this.data = data;
        this.width = 648;
        this.height = 800;
        this.initialThreshold = 0.9;
        this.map = L.map('map-view').setView([37.551, 127.0406], 14); // Center on Seongdong-gu, Seoul

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(this.map);

        this.pathCounts = this.calculatePathCounts();
        this.top10PercentThreshold = this.initialThreshold; // Initial threshold
        this.map.on('zoomend', () => this.updatePaths());
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

    updatePaths() {
        // Adjust threshold based on zoom level
        const zoomLevel = this.map.getZoom();
        this.top10PercentThreshold = Math.min(1, Math.max(0, this.initialThreshold - (zoomLevel - 14) * 0.06));

        const counts = Object.values(this.pathCounts).sort((a, b) => a - b);
        const thresholdValue = d3.quantile(counts, this.top10PercentThreshold);

        this.topPaths = Object.entries(this.pathCounts)
            .filter(([key, count]) => count >= thresholdValue)
            .map(([key, count]) => ({ key, count }));

        this.topPaths.sort((a, b) => a.count - b.count);

        this.colorScale = d3.scaleQuantize()
            .domain([0, this.topPaths.length])
            .range(d3.range(10).map(i => d3.interpolateReds(i / 9)));

        this.thicknessScale = d3.scaleQuantize()
            .domain([0, this.topPaths.length])
            .range(d3.range(10).map(i => 2.0 + i / 2));

        this.clearPaths();
        this.drawPaths();
        this.drawLegend();
    }

    clearPaths() {
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
                this.map.removeLayer(layer);
            }
        });
    }

    drawPaths() {
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

    drawLegend() {
        const legendContainer = d3.select('#legend');
        legendContainer.html(""); // Clear previous content

        // Set styles directly in JavaScript
        legendContainer
            .style('position', 'absolute')
            .style('left', '47%')
            .style('bottom', '20px')
            .style('width', '50%')
            .style('height', '55px')
            .style('background-color', 'white')
            .style('padding', '10px 0px 0px 0px')
            .style('border-radius', '5px')
            .style('box-shadow', '0 0 10px rgba(0, 0, 0, 0.5)')
            .style('z-index', '1000');

        const svg = legendContainer.append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
			.attr('viewBox', '0 0 270 43')

        const gradient = svg.append('defs').append('linearGradient')
            .attr('id', 'gradient')
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '0%');

        for (let i = 0; i <= 10; i++) {
            gradient.append('stop')
                .attr('offset', `${i * 10}%`)
                .attr('style', `stop-color:${d3.interpolateReds(i / 10)};stop-opacity:1`);
        }

        svg.append('rect')
            .attr('width', '100%')
            .attr('height', '20')
            .attr('fill', 'url(#gradient)');

        // Add description text above the colormap
        svg.append('text')
            .attr('x', '50%')
            .attr('y', '15')
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Traffic Top N% of Paths');

        // Add 0%, 50%, 100% labels below the colormap
        const labels = [0, 50, 100];
        const labelGroup = svg.append('g')
            .attr('transform', 'translate(0, 20)'); // Adjust label position

        labels.forEach((d, i) => {
            labelGroup.append('text')
                .attr('x', `${i * 50}%`)
                .attr('y', 10)
                .attr('dy', '.35em')
                .style('text-anchor', 'middle')
                .text(d + '%');
        });
    }

    initialize() {
        this.updatePaths(); // Initial rendering
    }
}
