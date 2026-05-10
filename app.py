from flask import Flask, render_template, request, jsonify
import csv
import math
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DRUG_FILE = os.path.join(BASE_DIR, "static/data/drugs.csv")
SOLVENT_FILE = os.path.join(BASE_DIR, "static/data/solvents.csv")


# =====================================================
# LOAD CSV
# =====================================================

def load_csv(path):

    data = []

    with open(path, newline='', encoding='utf-8') as file:

        reader = csv.DictReader(file)

        for row in reader:

            try:

                data.append({
                    "name": row["name"].strip(),
                    "dd": float(row["dd"]),
                    "dp": float(row["dp"]),
                    "dh": float(row["dh"])
                })

            except:
                continue

    return data


drugs = load_csv(DRUG_FILE)
solvents = load_csv(SOLVENT_FILE)


# =====================================================
# HOME PAGE
# =====================================================

@app.route("/")
def home():
    return render_template("index.html")


# =====================================================
# SEARCH API
# =====================================================

@app.route("/search")
def search_drugs():

    # Get query from URL
    query = request.args.get("q", "").lower().strip()

    # Empty query protection
    if query == "":
        return jsonify([])

    # Filter matching drugs
    filtered = [
        drug for drug in drugs
        if query in drug["name"].lower()
    ]

    # Limit to first 10 results
    filtered = filtered[:10]

    # Return JSON response
    return jsonify(filtered)


# =====================================================
# DISTANCE FUNCTION
# =====================================================

def get_ra(drug, solvent):

    return math.sqrt(
        4 * (drug["dd"] - solvent["dd"])**2 +
        (drug["dp"] - solvent["dp"])**2 +
        (drug["dh"] - solvent["dh"])**2
    )

# =====================================================
# HSP PREDICTION API
# =====================================================

@app.route("/predict", methods=["POST"])
def predict():

    data = request.json

    drug_name = data.get("drug", "").strip()

    r0 = float(data.get("r0", 10))

    top_n = int(data.get("top_n", 50))

    # =================================================
    # FIND SELECTED DRUG
    # =================================================

    selected_drug = None

    for d in drugs:

        if d["name"].lower() == drug_name.lower():

            selected_drug = d
            break

    # =================================================
    # ERROR HANDLING
    # =================================================

    if not selected_drug:

        return jsonify({
            "error": "Drug not found"
        })

    # =================================================
    # RANK SOLVENTS
    # =================================================

    ranked = []

    for s in solvents:

        # Hansen distance
        ra = get_ra(selected_drug, s)

        # Similarity percentage
        similarity = max(
            0,
            ((r0 - ra) / r0) * 100
        )

        ranked.append({

            "name": s["name"],

            "dd": s["dd"],
            "dp": s["dp"],
            "dh": s["dh"],

            "ra": round(ra, 2),

            "similarity": round(similarity, 2),

            # Inside / Outside sphere
            "inside": ra <= r0
        })

    # =================================================
    # SORT SOLVENTS
    # =================================================

    ranked.sort(

        key=lambda x: (
            x["ra"],
            -x["similarity"]
        )
    )

    # =================================================
    # SELECT TOP 300
    # =================================================

    top300 = ranked[:300]

    # =================================================
    # RETURN JSON
    # =================================================

    return jsonify({

        "drug": selected_drug,

        "r0": r0,

        "results": top300[:top_n]
    })

# =====================================================
# RUN FLASK APP
# =====================================================

if __name__ == "__main__":
    app.run(debug=True)