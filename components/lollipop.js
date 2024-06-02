class Lollipop {
    constructor(locationData, pathData) {
        this.margin = { top: 15, right: 63, bottom: 35, left: 137 };
        this.width = 648 - this.margin.left - this.margin.right;
        this.height = 372 - this.margin.top - this.margin.bottom;
        this.locationData = locationData;
        this.pathData = pathData;

        this.svg = d3.select("#lollipop").append("svg");
        this.container = this.svg.append("g");
        this.xAxis = this.svg.append("g");
        this.yAxis = this.svg.append("g");

        this.xScale = d3.scaleLinear();
        this.yScale = d3.scaleBand().padding(1);

        // Set initial attributes for SVG
        this.svg
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.container.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
        this.tooltip = d3.select("#sc-tooltip");
    }

    initialize() {
        this.update(this.locationData, this.pathData, 'paths', 'desc');
    }

    update(locationData, pathData, countMode, sortOrder) {
        this.currentMode = countMode;
        let data = [];

        if (countMode === 'paths') {
            data = Object.entries(pathData)
                .map(([key, value]) => {
                    const [start, end] = key.split('_');
                    const startName = this.locationData[start] ? this.locationData[start].name : start;
                    const endName = this.locationData[end] ? this.locationData[end].name : end;
                    return { key: `${startName}<->${endName}`, value: value };
                })
                .sort((a, b) => sortOrder === 'asc' ? a.value - b.value : b.value - a.value)
                .slice(0, 7);
        } else {
            data = Object.entries(locationData)
                .map(([key, value]) => {
                    let count = 0;
                    if (countMode === 'return') {
                        count = value.returnCount;
                    } else if (countMode === 'rent') {
                        count = value.rentCount;
                    } else if (countMode === 'combined') {
                        count = value.rentCount + value.returnCount;
                    }
                    return { key: value.name, value: count };
                })
                .sort((a, b) => sortOrder === 'asc' ? a.value - b.value : b.value - a.value)
                .slice(0, 7);
        }

        // Clear previous chart
        this.container.selectAll("*").remove();

        // Update scales
        this.xScale.domain([0, d3.max(data, d => d.value)]).range([0, this.width]);
        this.yScale.domain(data.map(d => d.key)).range([0, this.height]);

        // Update axes
        const xAxis = d3.axisBottom(this.xScale)
            .tickFormat(d3.format('d')); // Format ticks as integers

        if (d3.max(data, d => d.value) <= 1) {
            xAxis.tickValues([0, 1]);
        }

        this.xAxis
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top + this.height})`)
            .transition().duration(1000)
            .call(xAxis);


        if (countMode === "paths") {
            this.yAxis
                .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
                .call(d3.axisLeft(this.yScale).tickFormat(d => ''));
        } else {
            this.yAxis
                .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
                .transition().duration(1000)
                .call(d3.axisLeft(this.yScale));
        }

        if (countMode === "paths") {
            this.container.selectAll(".y-axis-label")
                .data(data)
                .join("text")
                .attr("class", "y-axis-label")
                .attr("x", -10)
                .attr("y", d => this.yScale(d.key))
                .style("font-size", "10px")
                .style("text-anchor", "end")
                .selectAll("tspan")
                .data(d => [`${d.key.split('<->')[0]}`, `${d.key.split('<->')[1]}`])
                .join("tspan")
                .attr("x", -10)
                .attr("dy", (d, i) => i === 0 ? 0 : "1.1em")
                .text(d => d);
        }

        // Draw lines
        this.container.selectAll("line")
            .data(data)
            .join("line")
            .attr("y1", d => this.yScale(d.key))
            .attr("y2", d => this.yScale(d.key))
            .transition().duration(1000)
            .attr("x1", this.xScale(0))
            .attr("x2", d => this.xScale(d.value))
            .attr("stroke", "grey");

        // Draw circles
        this.container.selectAll("circle")
            .data(data)
            .join("circle")
			.on('mouseover', (event, d) => {
                this.tooltip.style("display", "block").select(".tooltip-inner").text(`Count: ${d.value}`);
                this.tooltip.style("top", `${event.pageY - 37}px`).style("left", `${event.pageX - 8}px`);
            })
            .on('mousemove', (event, d) => {
                this.tooltip.style("top", `${event.pageY - 37}px`).style("left", `${event.pageX - 8}px`);
            })
            .on('mouseout', () => {
                this.tooltip.style("display", "none");
            })
            .attr("cy", d => this.yScale(d.key))
			.transition().duration(1000)
            .attr("cx", d => this.xScale(d.value))
            .attr("r", 7)
            .style("fill", "#69b3a2")
            .attr("stroke", "black");
		}
}
