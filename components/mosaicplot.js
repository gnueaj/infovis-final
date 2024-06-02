class MosaicPlot {
    constructor(data) {
        this.margin = { top: 20, right: 20, bottom: 19, left: 37 };
        this.width = 648 - this.margin.left - this.margin.right;
        this.height = 372 - this.margin.top - this.margin.bottom;
        this.data = data;
		
        this.svg = d3.select("#mosaic-plot").append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

        this.color = d3.scaleOrdinal()
            .domain(["M", "F"])
            .range(["#191970", "#B76E79"]);
    }

    initialize() {
        this.renderPlot();
    }

    renderPlot() {
        const groupedData = d3.rollup(this.data, v => v.length,
            d => {
                const birthYear = +d.BIRTH_YEAR;
                if (birthYear < 1965) return "-1964";
                else if (birthYear <= 1974) return "1965-1974";
                else if (birthYear <= 1984) return "1975-1984";
                else if (birthYear <= 1994) return "1985-1994";
                else if (birthYear <= 2004) return "1995-2004";
                else return "2005-";
            },
            d => d.SEX_CD
        );

        const birthYearGroups = ["-1964", "1965-1974", "1975-1984", "1985-1994", "1995-2004", "2005-"];
        const sexGroups = ["M", "F"];

        const totalCounts = new Map();
        for (const [yearGroup, genders] of groupedData.entries()) {
            totalCounts.set(yearGroup, d3.sum(genders.values()));
        }

        const totalOverallCount = d3.sum(totalCounts.values());
        const birthYearWidths = new Map();
        for (const [yearGroup, totalCount] of totalCounts.entries()) {
            birthYearWidths.set(yearGroup, totalCount / totalOverallCount * (this.width - birthYearGroups.length * 5));
        }

        const mosaicData = [];
        for (const yearGroup of birthYearGroups) {
            const totalCount = totalCounts.get(yearGroup);
            let accumulatedHeight = 0;
            for (const sexGroup of sexGroups) {
                const count = groupedData.get(yearGroup)?.get(sexGroup) || 0;
                const percentage = count / totalCount;
                mosaicData.push({
                    yearGroup: yearGroup,
                    sexGroup: sexGroup,
                    count: count,
                    percentage: percentage,
                    y0: accumulatedHeight,
                    y1: accumulatedHeight + percentage - 0.004
                });
                accumulatedHeight += percentage + 0.004;
            }
        }

        let accumulatedWidth = 0;
		
        for (const yearGroup of birthYearGroups) {
            const width = birthYearWidths.get(yearGroup);
            for (const d of mosaicData) {
                if (d.yearGroup === yearGroup) {
                    d.x0 = accumulatedWidth;
                    d.x1 = accumulatedWidth + width - 1.2;
                }
            }
            accumulatedWidth += width + 1.2; // Add space between groups
        }

        console.log(mosaicData);
        this.svg.selectAll("rect")
            .data(mosaicData)
            .join("rect")
            .attr("x", d => d.x0)
            .attr("y", d => this.height * d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => this.height * (d.y1 - d.y0))
            .attr("fill", d => this.color(d.sexGroup))


        const x = d3.scaleBand().domain(birthYearGroups).range([0, this.width - 25]);
        const y = d3.scaleLinear().range([this.height, 0]).domain([0, 1]);

		function calXaxisPos(mosaicData, width, d, i){
			const fData = mosaicData.find(m => m.yearGroup === d && m.sexGroup === "F");
            return (fData.x0 + fData.x1) / 2 - (width / 6.25) * (i) - 46;
		}

        this.svg.append("g")
            .attr("transform", `translate(0, ${this.height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "middle")
			.attr("x", (d, i) => {
                return calXaxisPos(mosaicData, this.width, d, i);
            });

		this.svg.selectAll(".tick line")
        	.attr("x1", (d, i) => {
        	    return calXaxisPos(mosaicData, this.width , d, i);
        	})
        	.attr("x2", (d, i) => {
        	    return calXaxisPos(mosaicData, this.width , d, i);
        	});

        this.svg.append("g")
            .call(d3.axisLeft(y).ticks(5, "%"));

        const tooltip = d3.select("#sc-tooltip");

        const mouseover = function(event, d) {
            tooltip.style("display", "block")
                .select(".tooltip-inner").html(`Birth Year: ${d.yearGroup}<br>
												Gender: ${d.sexGroup}<br>
												Count: ${d.count}`)
                .style("text-align", "left");
        };

        const mousemove = function(event, d) {
            tooltip.style("top", (event.pageY - 75) + "px")
                .style("left", (event.pageX - 10) + "px");
        };

        const mouseleave = function(event, d) {
            tooltip.style("display", "none");
        };

        this.svg.selectAll("rect")
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseout", mouseleave);

        this.renderLegend();
    }

    renderLegend() {
        this.svg.select(".legend").remove();

        const legend = d3.legendColor()
            .shapeWidth(30)
            .orient('vertical')
            .scale(this.color);

        const legendGroup = this.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${this.width - 125}, 20)`);

        legendGroup.append("rect")
            .attr("x", -10)
            .attr("y", -10)
            .attr("width", 100)
            .attr("height", 60)
            .attr("rx", 10) 
            .attr("ry", 10) 
            .attr("fill", "white")
            .attr("opacity", 0.5) 
            .attr("stroke", "black");

        legendGroup.call(legend);
    }
}
