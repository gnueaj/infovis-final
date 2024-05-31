class Map {
    constructor(data) {
        this.data = data;
        this.width = 648;
        this.height = 800;
        this.initialThreshold = 0.91;
        this.map = L.map('map-view').setView([37.551, 127.043], 14); // Center on Seongdong-gu, Seoul
        this.state = 'Paths'

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(this.map);

        this.pathCounts = this.calculatePathCounts();
        this.returnCounts = this.calculateReturnCounts();
        this.rentCounts = this.calculateRentCounts();
        this.combinedCounts = this.calculateCombinedCounts();
        this.top10PercentThreshold = this.initialThreshold; // Initial threshold
        this.map.on('zoomend', () => this.updatePaths(this.state));
        this.addButtons();
    }
    
    initialize() {
        this.updatePaths(this.state); // Initial rendering
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

    calculateReturnCounts() {
        const returnCounts = {};
        this.data.forEach(d => {
            const end = `${d.RTN_LAT},${d.RTN_LON}`;

            if (!returnCounts[end]) {
                returnCounts[end] = 0;
            }
            returnCounts[end]++;
        });
        return returnCounts;
    }

    calculateRentCounts() {
        const rentCounts = {};
        this.data.forEach(d => {
            const start = `${d.RENT_LAT},${d.RENT_LON}`;

            if (!rentCounts[start]) {
                rentCounts[start] = 0;
            }
            rentCounts[start]++;
        });
        return rentCounts;
    }

    calculateCombinedCounts() {
        const combinedCounts = {};
        this.data.forEach(d => {
            const start = `${d.RENT_LAT},${d.RENT_LON}`;
            const end = `${d.RTN_LAT},${d.RTN_LON}`;

            if (!combinedCounts[start]) {
                combinedCounts[start] = 0;
            }
            if (!combinedCounts[end]) {
                combinedCounts[end] = 0;
            }
            combinedCounts[start]++;
            combinedCounts[end]++;
        });
        return combinedCounts;
    }

    updatePaths(state) {
        this.state = state
        if(this.state !== 'Paths') 
            return;
        // Adjust threshold based on zoom level
        const zoomLevel = this.map.getZoom();
        this.top10PercentThreshold = Math.min(1, Math.max(0, this.initialThreshold - (zoomLevel - 14) * 0.05));
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
                weight: 1, // 테두리 두께
                fillOpacity: 0.2 // 중간의 투명도
            }).addTo(this.map);

            L.circleMarker(end, {
                color: 'red',
                radius: 3,
                opacity: 1,
                weight: 1, // 테두리 두께
                fillOpacity: 0.2 // 중간의 투명도
            }).addTo(this.map);
        });
    }

    drawLegend() {
        const legendContainer = d3.select('#legend');
        legendContainer.html(""); // Clear previous content

        // Set styles directly in JavaScript
        legendContainer
            .style('position', 'absolute')
            .style('left', '47.4%')
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
            .attr('viewBox', '0 0 270 43');

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
            .style('font-weight', 'bold')
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

    addButtons() {
        const buttonContainer = d3.select('#map-btn')
            .attr('class', 'button-container')
            .style('position', 'absolute')
            .style('left', '20px')
            .style('bottom', '20px')
            .style('background-color', 'white')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('box-shadow', '0 0 10px rgba(0, 0, 0, 0.5)')
            .style('z-index', '1000');

        const buttons = [
            { id: 'return-locations', text: 'Return', handler: () => this.showReturnLocations() },
            { id: 'rent-locations', text: 'Rent', handler: () => this.showRentLocations() },
            { id: 'combined-locations', text: 'Combined', handler: () => this.showCombinedLocations() },
            { id: 'Paths', text: 'Paths', handler: () => this.updatePaths('Paths') }
        ];

        buttons.forEach(button => {
            buttonContainer.append('button')
                .attr('id', button.id)
                .text(button.text)
                .on('click', button.handler)
                .style('margin', '3px 4px 3px 4px')
                .style('padding', '4px 6px 4px 6px')
                .style('border', 'none')
                .style('border-radius', '3px')
                .style('background-color', '#777777')
                .style('color', 'white')
                .style('font-size', '14px')
                .style('cursor', 'pointer')
                .on('mouseover', function() {
                    d3.select(this).style('background-color', '#111111');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background-color', '#666666');
                });
        });
    }

    showReturnLocations() {
        this.clearPaths();
        this.state = 'Bubble'
        Object.entries(this.returnCounts).forEach(([location, count]) => {
            const [lat, lon] = location.split(',').map(Number);
            L.circleMarker([lat, lon], {
                color: 'blue',
                radius: 1 + Math.sqrt(count / 2),
                fillOpacity: 0.5,
                weight: 2
            }).addTo(this.map);
        });
    }

    showRentLocations() {
        this.clearPaths();
        this.state = 'Bubble'
        Object.entries(this.rentCounts).forEach(([location, count]) => {
            const [lat, lon] = location.split(',').map(Number);
            L.circleMarker([lat, lon], {
                color: 'green',
                radius: 1 + Math.sqrt(count / 2),
                fillOpacity: 0.5,
                weight: 2
            }).addTo(this.map);
        });
    }

    showCombinedLocations() {
        this.clearPaths();
        this.state = 'Bubble'
        Object.entries(this.combinedCounts).forEach(([location, count]) => {
            const [lat, lon] = location.split(',').map(Number);
            L.circleMarker([lat, lon], {
                color: 'purple',
                radius: 1 + Math.sqrt(count / 2),
                fillOpacity: 0.5,
                weight: 2
            }).addTo(this.map);
        });
    }
}
