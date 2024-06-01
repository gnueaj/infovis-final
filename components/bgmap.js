class Bgmap {
    constructor(data) {
        this.data = data;
        this.width = 648;
        this.height = 800;
        this.initialThreshold = 0.91;
        if (!Map.instance) {
            this.map = L.map('map-view').setView([37.553, 127.043], 14); // Center on Seongdong-gu, Seoul
            Map.instance = this.map;
        } else {
            this.map = Map.instance;
        }        
        this.state = 'Paths';

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(this.map);
        this.map.on('zoomend', () => this.updatePaths(this.state));
    }

    initialize() { 
        this.addButtons();
        this.drawLegend();
        this.initializeData();
        this.updatePaths(this.state); 
    }

    initializeData() {
        const pathCounts = {};
        const returnCounts = {};
        const rentCounts = {};
        const combinedCounts = {};
        const markerData = {};

        this.data.forEach(d => {
            const start = `${d.RENT_LAT},${d.RENT_LON}`;
            const end = `${d.RTN_LAT},${d.RTN_LON}`;
            const pathKey = [start, end].sort().join("_");

            // Path counts
            if (!pathCounts[pathKey]) {
                pathCounts[pathKey] = 0;
            }
            pathCounts[pathKey]++;

            // Return counts
            if (!returnCounts[end]) {
                returnCounts[end] = 0;
            }
            returnCounts[end]++;

            // Rent counts
            if (!rentCounts[start]) {
                rentCounts[start] = 0;
            }
            rentCounts[start]++;

            // Combined counts
            if (!combinedCounts[start]) {
                combinedCounts[start] = 0;
            }
            if (!combinedCounts[end]) {
                combinedCounts[end] = 0;
            }
            combinedCounts[start]++;
            combinedCounts[end]++;

            // Marker data
            if (!markerData[start]) {
                markerData[start] = { name: d.RENT_NM, rentCount: 0, returnCount: 0 };
            }
            if (!markerData[end]) {
                markerData[end] = { name: d.RTN_NM, rentCount: 0, returnCount: 0 };
            }
            markerData[start].rentCount++;
            markerData[end].returnCount++;
        });
        this.pathCounts = pathCounts;
        this.returnCounts = returnCounts;
        this.rentCounts = rentCounts;
        this.combinedCounts = combinedCounts;
        this.markerData = markerData;
    }

    drawLegend() {
        const legendContainer = d3.select('#legend');
        legendContainer.html("");

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

        svg.append('text')
            .attr('x', '50%')
            .attr('y', '15')
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text('Traffic Top N% of Paths');

        const labels = [0, 50, 100];
        const labelGroup = svg.append('g')
            .attr('transform', 'translate(0, 20)');

        labels.forEach((d, i) => {
            labelGroup.append('text')
                .attr('x', `${i * 50}%`)
                .attr('y', 10)
                .attr('dy', '.35em')
                .style('text-anchor', 'middle')
                .text(d + '%');
        });
    }

    hideLegend() {
        d3.select('#legend').style('display', 'none');
    }

    showLegend() {
        d3.select('#legend').style('display', 'block');
    }

    addButtons() {
        const buttonContainer = d3.select('#map-btn')
            .attr('class', 'button-container')
            .style('display', 'block');

        const buttons = [
            { id: 'return-locations', text: 'Return Count', handler: () => this.showReturnLocations() },
            { id: 'rent-locations', text: 'Rental Count', handler: () => this.showRentLocations() },
            { id: 'combined-locations', text: 'Total', handler: () => this.showCombinedLocations() },
            { id: 'paths', text: 'Paths', handler: () => this.updatePaths('Paths') }
        ];

        buttons.forEach(button => {
            buttonContainer.append('button')
                .attr('id', button.id)
                .text(button.text)
        });
    }

    updatePaths(state) {
        this.state = state;
        if (this.state !== 'Paths') {
            this.hideLegend();
            return;
        }
        this.showLegend();

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
            .range(d3.range(10).map(i => 1.5 + i * 0.8 ));

        this.clearPaths();
        this.drawPaths();
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
            const [start, end] = key.split('_').map(d => d.split(',').map(Number));
            const weight = this.thicknessScale(index);
            const color = this.colorScale(index);

            const from = start.join(',');
            const to = end.join(',');

            L.polyline([start, end], {
                color: color,
                weight: weight,
                opacity: 0.7
            }).bindTooltip(`<strong>${this.markerData[from].name} <-> ${this.markerData[to].name}</strong><br>
                            Path Count: ${count}`).addTo(this.map);
        });

        Object.keys(this.markerData).forEach(locationKey => {
            const marker = this.markerData[locationKey];
            const [lat, lon] = locationKey.split(',').map(Number);
    
            L.circleMarker([lat, lon], {
                color: 'red',
                radius: 4,
                opacity: 1,
                weight: 1, 
                fillOpacity: 1 
            }).bindTooltip(`<strong>${marker.name}</strong><br>
                            Rental Count: ${marker.rentCount}<br>
                            Return Count: ${marker.returnCount}<br>
                            Total: ${marker.rentCount + marker.returnCount}<br>`).addTo(this.map);
        });
    }

    showReturnLocations() {
        this.clearPaths();
        this.hideLegend();
        this.state = 'Bubble';
        Object.entries(this.returnCounts).forEach(([location, count]) => {
            const [lat, lon] = location.split(',').map(Number);
            L.circleMarker([lat, lon], {
                color: 'blue',
                radius: Math.sqrt(count * 0.8),
                fillOpacity: 0.5,
                weight: 2
            }).bindTooltip(`<strong>${this.markerData[location].name}</strong><br>
                            Return Count: ${this.markerData[location].returnCount}`).addTo(this.map);
        });
    }

    showRentLocations() {
        this.clearPaths();
        this.hideLegend();
        this.state = 'Bubble';
        Object.entries(this.rentCounts).forEach(([location, count]) => {
            const [lat, lon] = location.split(',').map(Number);
            L.circleMarker([lat, lon], {
                color: 'green',
                radius: Math.sqrt(count * 0.8),
                fillOpacity: 0.5,
                weight: 2
            }).bindTooltip(`<strong>${this.markerData[location].name}</strong><br>
                            Rental Count: ${this.markerData[location].rentCount}`).addTo(this.map);
        });
    }

    showCombinedLocations() {
        this.clearPaths();
        this.hideLegend();
        this.state = 'Bubble';
        Object.entries(this.combinedCounts).forEach(([location, count]) => {
            const [lat, lon] = location.split(',').map(Number);
            L.circleMarker([lat, lon], {
                color: 'purple',
                radius: Math.sqrt(count * 0.8),
                fillOpacity: 0.5,
                weight: 2
            }).bindTooltip(`<strong>${this.markerData[location].name}</strong><br>
                            Rental Count: ${this.markerData[location].rentCount}<br>
                            Return Count: ${this.markerData[location].returnCount}<br>
                            Total: ${this.markerData[location].rentCount + this.markerData[location].returnCount}<br>`).addTo(this.map);
        });
    }
}
