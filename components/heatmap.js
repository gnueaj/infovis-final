class Heatmap {
    constructor(data) {
        this.margin = { top: 20, right: 100, bottom: 20, left: 30 };
        this.width = 648 - this.margin.left - this.margin.right;
        this.height = 372 - this.margin.top - this.margin.bottom;
        this.data = data;

        this.svg = d3.select("#heatmap").append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right + 100)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
          .append("g")
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
        
        this.x = d3.scaleBand()
            .range([0, this.width])
            .padding(0.01);
        
        this.y = d3.scaleBand()
            .range([this.height, 0])
            .padding(0.01);
        
        this.myColor = d3.scaleSequential(d3.interpolatePurples)
            .domain([0, 100]);
    }

    initialize() {
        const parseTime = d3.timeParse("%Y-%m-%d %H:%M");

        const heatmapData = [];

        this.data.forEach(d => {
            const date = parseTime(d.RENT_DT);
            const dayOfWeek = (date.getDay() + 6) % 7;
            const hour = date.getHours();
            const timeSlot = Math.floor((hour + 1) / 2) * 2; 

            heatmapData.push({
                day: dayOfWeek,
                time: timeSlot
            });
        });

        const groupedData = d3.rollup(heatmapData, v => v.length, d => d.day, d => d.time);

        const flattenedData = [];
        for (const [day, times] of groupedData.entries()) {
            for (const [time, value] of times.entries()) {
                flattenedData.push({ day, time, value });
            }
        }

        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		function convertDays(day){
			if(day === "Mon") return "Monday";
			else if(day === "Tue") return "Tuesday";
			else if(day === "Wed") return "Wednesday";
			else if(day === "Thu") return "Thursday";
			else if(day === "Fri") return "Friday";
			else if(day === "Sat") return "Saturday";
			else if(day === "Sun") return "Sunday";
			else return "Undefined";
		}
        const times = Array.from({ length: 12 }, (_, i) => i * 2); // [0, 2, 4, ..., 22]

        this.x.domain(times);
        this.y.domain(days);

        this.myColor.domain([0, d3.max(flattenedData, d => d.value)]);

        // Add axes
        this.svg.append("g")
            .attr("transform", `translate(0, ${this.height})`)
            .call(d3.axisBottom(this.x).tickFormat(d => `${d}:00`));
        
        this.svg.append("g")
            .call(d3.axisLeft(this.y));

        // Create a tooltip
        const tooltip = d3.select("#sc-tooltip");

        const mouseover = function(event, d) {
            tooltip.style("display", "block")
                .select(".tooltip-inner").html(`Day: ${convertDays(days[d.day])}<br>
												Time: ${d.time - 1}:00 - ${d.time + 1}:00<br>
												Count: ${d.value}`)
				.style("text-align", "left");
        };

        const mousemove = function(event, d) {
            tooltip.style("top", (event.pageY - 75) + "px")
                .style("left", (event.pageX - 10) + "px");
        };

        const mouseleave = function(event, d) {
            tooltip.style("display", "none");
        };

        // Draw the heatmap
        this.svg.selectAll()
          .data(flattenedData, function(d) { return d.day + ':' + d.time; })
          .join("rect")
          .attr("x", d => this.x(d.time))
          .attr("y", d => this.y(days[d.day]))
          .attr("width", this.x.bandwidth())
          .attr("height", this.y.bandwidth())
          .style("fill", d => this.myColor(d.value))
          .on("mouseover", mouseover)
          .on("mousemove", mousemove)
          .on("mouseleave", mouseleave);

        // Add legend
        const legendHeight = 333;
        const legendWidth = 25;

        const defs = this.svg.append("defs");

        const linearGradient = defs.append("linearGradient")
            .attr("id", "linear-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        linearGradient.selectAll("stop")
            .data(this.myColor.ticks().map((t, i, n) => ({ 
                offset: `${100 * i / n.length}%`, 
                color: this.myColor(t) 
            })))
            .join("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);

        this.svg.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#linear-gradient)")
            .attr("transform", `translate(${this.width + 20}, 0)`);

        const legendScale = d3.scaleLinear()
            .domain(this.myColor.domain())
            .range([legendHeight, 0]);
		
        this.svg.append("g")
            .attr("transform", `translate(${this.width + 45}, 0)`)
            .call(d3.axisRight(legendScale));
    }
}
