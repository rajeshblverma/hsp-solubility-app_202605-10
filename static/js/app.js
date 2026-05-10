function go(id) {
  document.querySelectorAll('.page').forEach(function(p){
    p.classList.remove('on');
  });

  document.querySelectorAll('.tab').forEach(function(t){
    t.classList.remove('on');
  });

  var pg = document.getElementById('p-' + id);
  var tb = document.getElementById('t-' + id);

  if (pg) pg.classList.add('on');
  if (tb) tb.classList.add('on');

  window.scrollTo(0, 0);
}

// ==========================================
// GLOBAL SELECTED DRUG
// ==========================================

let currentDrug = null;

// ==========================================
// ADD filterDrugs() FUNCTION
// ==========================================

async function filterDrugs() {

    const query = document
        .getElementById("drug-search")
        .value
        .trim();

    const box = document.getElementById("search-results");

    // Hide empty search
    if (query.length < 1) {

        box.classList.add("hidden");

        return;
    }

    // ==========================================
    // SEARCH API
    // ==========================================

    const response = await fetch(
        `/search?q=${encodeURIComponent(query)}`
    );

    const drugs = await response.json();

    // Clear previous results
    box.innerHTML = "";

    // Show dropdown
    box.classList.remove("hidden");

    drugs.forEach(d => {

        const div = document.createElement("div");

        div.className =
            "p-2 hover:bg-gray-100 cursor-pointer text-sm";

        div.innerText = d.name;

        div.onclick = () => {

            currentDrug = d;

            document.getElementById(
                "drug-search"
            ).value = d.name;

            box.classList.add("hidden");

            updatePlot();
        };

        box.appendChild(div);
    });
}



// ==========================================
// ADD updatePlot() FUNCTION
// ==========================================

async function updatePlot() {

    // No drug selected
    if (!currentDrug) return;

    // Get R₀
    const r0 = parseFloat(
        document.getElementById("r-slider").value
    );

    // Update slider display
    document.getElementById("r-value").innerText = r0;

    // ==========================================
    // CALL FLASK API
    // ==========================================

    const response = await fetch("/predict", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            drug: currentDrug.name,

            r0: r0,

            top_n: 350
        })
    });

    if (!response.ok) {

    document.getElementById("results").innerHTML =
        "Server error occurred.";

    return;
}

const data = await response.json();

    // ==========================================
    // ERROR HANDLING
    // ==========================================

    if (data.error) {

        document.getElementById("results").innerHTML =
            data.error;

        return;
    }

    // ==========================================
    // UPDATE DRUG INFO
    // ==========================================

    document.getElementById("info").innerHTML = `
        <b>${data.drug.name}</b><br>
        δD: ${data.drug.dd}<br>
        δP: ${data.drug.dp}<br>
        δH: ${data.drug.dh}
    `;

    // ==========================================
    // RESULTS DISPLAY
    // ==========================================

    const resultsHTML = data.results.map((s, index) => {

        return `

        <div class="result-item">

            <div class="flex justify-between items-center">

                <div>

                    <div class="font-semibold text-gray-900">
                        ${index + 1}. ${s.name}
                    </div>

                    <div class="text-xs text-gray-500 mt-1">
                        Ra: ${s.ra.toFixed(2)}
                    </div>

                </div>

                <div class="text-green-700 font-bold">
                    ${s.similarity.toFixed(0)}%
                </div>

            </div>

            <div class="progress-bar">

                <div
                    class="progress-fill"
                    style="width:${s.similarity}%"
                ></div>

            </div>

        </div>

        `;

    }).join("");

    document.getElementById("results").innerHTML = resultsHTML;

    // ==========================================
    // PREPARE PLOT DATA
    // ==========================================

    const insideX = [];
    const insideY = [];
    const insideZ = [];
    const insideText = [];

    const outsideX = [];
    const outsideY = [];
    const outsideZ = [];
    const outsideText = [];

    data.results.forEach(s => {

        if (s.inside) {

            insideX.push(s.dd);
            insideY.push(s.dp);
            insideZ.push(s.dh);
            insideText.push(s.name);

        } else {

            outsideX.push(s.dd);
            outsideY.push(s.dp);
            outsideZ.push(s.dh);
            outsideText.push(s.name);
        }
    });

    // ==========================================
    // HSP SPHERE
    // ==========================================

    const u = [];
    const v = [];

    const x = [];
    const y = [];
    const z = [];

    // Angular mesh
    for (let i = 0; i <= 200; i++) {

        u.push(i * Math.PI / 200);

        v.push(i * 2 * Math.PI / 200);
    }

    // Sphere coordinates
    for (let i = 0; i < u.length; i++) {

        let xr = [];
        let yr = [];
        let zr = [];

        for (let j = 0; j < v.length; j++) {

            xr.push(
                2 * data.drug.dd +
                r0 * Math.sin(u[i]) * Math.cos(v[j])
            );

            yr.push(
                data.drug.dp +
                r0 * Math.sin(u[i]) * Math.sin(v[j])
            );

            zr.push(
                data.drug.dh +
                r0 * Math.cos(u[i])
            );
        }

        x.push(xr);
        y.push(yr);
        z.push(zr);
    }


    // ==========================================
    // PLOTLY TRACES
    // ==========================================

    // ==========================================
    // HSP SPHERE
    // ==========================================

    const sphereTrace = {

        x: x,
        y: y,
        z: z,

        type: "surface",

        opacity: 0.2,

        showscale: false,

        hoverinfo: "skip",

        contours: {
            x: { show: false },
            y: { show: false },
            z: { show: false }
        },

        lighting: {
            ambient: 1
        },

        name: "HSP Sphere"
    };

    // ==========================================
    // DRUG TRACE
    // ==========================================

    const drugTrace = {

        x: [2 * data.drug.dd],

        y: [data.drug.dp],

        z: [data.drug.dh],

        text: [data.drug.name],

        mode: "markers+text",

        type: "scatter3d",

        name: "Drug",

        marker: {
            size: 8,
            color: "red"
        },

        textposition: "top center",

        textfont: {
            size: 14,
            color: "red"
        },

        
        hovertemplate:
            "<b>%{text}</b><br>" +
            "δD: %{x}<br>" +
            "δP: %{y}<br>" +
            "δH: %{z}<extra></extra>"
    
    };

    // ==========================================
    // INSIDE SPHERE TRACE
    // ==========================================

    const insideTrace = {

        x: insideX.map(v => 2 * v),

        y: insideY,

        z: insideZ,

        text: insideText,

        mode: "markers+text",

        type: "scatter3d",

        name: "Inside Sphere",

        marker: {
            size: 5,
            color: "green"
        },


        textposition: "top center",

        textfont: {
            size: 10,
            color: "green"
        },




        hoverinfo: "text",
        
        hovertemplate:
            "<b>%{text}</b><br>" +
            "2δD: %{x}<br>" +
            "δP: %{y}<br>" +
            "δH: %{z}<extra></extra>"

    };

    // ==========================================
    // OUTSIDE SPHERE TRACE
    // ==========================================

    const outsideTrace = {

        x: outsideX.map(v => 2 * v),

        y: outsideY,

        z: outsideZ,

        text: outsideText,

        mode: "markers+text",

        type: "scatter3d",

        name: "Outside Sphere",

        marker: {
            size: 5,
            color: "gray"
        },


        textposition: "top center",

        textfont: {
            size: 10,
            color: "gray"
        },
        
        hoverinfo: "text",

        hovertemplate:
            "<b>%{text}</b><br>" +
            "2δD: %{x}<br>" +
            "δP: %{y}<br>" +
            "δH: %{z}<extra></extra>"
    };

    // ==========================================
    // DRAW PLOT
    // ==========================================

    Plotly.newPlot(

        "plot",

        [
            sphereTrace,
            drugTrace,
            insideTrace,
            outsideTrace
        ],

        {

            // ======================================
            // RESPONSIVE LAYOUT
            // ======================================

            responsive: true,

            autosize: true,

            title: `Hansen Sphere: ${data.drug.name}`,

            margin: {
                t: 40,
                l: 0,
                r: 0,
                b: 0
            },

            paper_bgcolor: "#ffffff",

            plot_bgcolor: "#ffffff",

            legend: {
                orientation: "h",
                y: 1.02
            },

            scene: {

                aspectmode: "cube",

                // ==================================
                // X AXIS
                // ==================================

                xaxis: {

                    title: "2δD",

                    backgroundcolor: "#f8fafc",

                    gridcolor: "#dbeafe",

                    zerolinecolor: "#94a3b8"
                },

                // ==================================
                // Y AXIS
                // ==================================

                yaxis: {

                    title: "δP",

                    backgroundcolor: "#f8fafc",

                    gridcolor: "#dbeafe",

                    zerolinecolor: "#94a3b8"
                },

                // ==================================
                // Z AXIS
                // ==================================

                zaxis: {

                    title: "δH",

                    backgroundcolor: "#f8fafc",

                    gridcolor: "#dbeafe",

                    zerolinecolor: "#94a3b8"
                }
            }
        },

        // ==========================================
        // PLOT CONFIGURATION
        // ==========================================

        {

            responsive: true,

            displaylogo: false,

            modeBarButtonsToRemove: [

                "lasso2d",
                "select2d"
            ]
        }
    );

}



// ==========================================
// INITIAL LOAD
// ==========================================

window.onload = async function () {

    try {

        // Default initial search
        const response = await fetch("/search?q=a");

        const drugs = await response.json();

        // Select first drug automatically
        if (drugs.length > 0) {

            currentDrug = drugs[0];

            document.getElementById(
                "drug-search"
            ).value = currentDrug.name;

            updatePlot();
        }

    } catch (error) {

        console.error(
            "Initial load failed:",
            error
        );
    }
};