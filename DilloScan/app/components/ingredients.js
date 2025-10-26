"use client";

import { useState } from "react";

export default function IngredientList({ analysisData }) {
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [sortOption, setSortOption] = useState("low"); // ✅ Added missing state

  if (!analysisData || !analysisData.success) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No ingredient data available</p>
      </div>
    );
  }

  const { ingredients, blurbs, schemas } = analysisData;

  // ---------- Calculate overall rating ----------
  const calculateOverallRating = () => {
    if (!schemas || Object.keys(schemas).length === 0) return null;

    // Safely parse ratings as numbers
    const ratings = Object.values(schemas)
      .map((schema) => {
        const value = parseFloat(schema.health_safety_rating);
        return !isNaN(value) && value >= 0 && value <= 1 ? value : null;
      })
      .filter((rating) => rating !== null);

    if (ratings.length === 0) return null;

    const avg = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return (avg * 100).toFixed(1); // convert to numeric 0–100 scale, single decimal
  };

  const overallRating = calculateOverallRating();

  const getRatingColor = (rating) => {
    if (rating >= 0.7) return "text-green-600 bg-green-100";
    if (rating >= 0.5) return "text-yellow-600 bg-yellow-100";
    if (rating >= 0.3) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  // ---------- Sorting logic ----------
  const sortedIngredients = [...ingredients].sort((a, b) => {
    const schemaA = schemas[a] || {};
    const schemaB = schemas[b] || {};
    const ratingA = parseFloat(schemaA.health_safety_rating) || 0;
    const ratingB = parseFloat(schemaB.health_safety_rating) || 0;

    switch (sortOption) {
      case "high": // high → low
        return ratingB - ratingA;
      case "label": // label order
        return ingredients.indexOf(a) - ingredients.indexOf(b);
      case "alpha": // alphabetical
        return a.localeCompare(b);
      default: // low → high
		return ratingA - ratingB;
    }
  });

  return (
    <div className="space-y-6">
      {/* ---------- Overall Rating Card ---------- */}
      {overallRating !== null && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 rounded-2xl p-6 border-2 border-indigo-200 dark:border-indigo-800">
          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
            Overall Health Safety Score
          </h3>
          <div className="flex items-center space-x-4">
            <div className="text-5xl font-bold text-indigo-600">{overallRating}</div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Based on {ingredients.length} ingredient
                {ingredients.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Ingredients List ---------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-green-500">
              Detected Ingredients ({ingredients.length})
          </h3>

          {/* Sorting Dropdown */
		  }
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          >
            <option value="label">Label order</option>
            <option value="high">Health safety (high to low)</option>
            <option value="low">Health safety (low to high)</option>
            <option value="alpha">Alphabetical</option>
          </select>
        </div>

        {sortedIngredients.map((ingredient, index) => {
          const schema = schemas[ingredient] || {};
          const ratingValue = parseFloat(schema.health_safety_rating);
          const rating = !isNaN(ratingValue)
            ? (ratingValue * 100).toFixed(1)
            : "N/A";

          return (
            <div
              key={index}
              onClick={() =>
                setSelectedIngredient(
                  selectedIngredient === ingredient ? null : ingredient
                )
              }
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                      {ingredient}
                    </h4>
                    <span
                      className={`transition-transform duration-300 text-gray-400 ${
                        selectedIngredient === ingredient ? "rotate-90" : ""
                      }`}
                    >
                      ▶
                    </span>
                  </div>

                  {blurbs[ingredient] && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {blurbs[ingredient]}
                    </p>
                  )}
                </div>

                {rating !== "N/A" && (
                  <div
                    className={`ml-4 px-3 py-1 rounded-full text-xs font-bold ${getRatingColor(
                      ratingValue
                    )}`}
                  >
                    {rating}
                  </div>
                )}
              </div>

              {/* ---------- Expanded Details ---------- */}
              {selectedIngredient === ingredient && schema && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 animate-fade-in">
                  {schema.chemical_properties && (
                    <div>
                      <h5 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">
                        Chemical Properties
                      </h5>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {schema.chemical_properties}
                      </p>
                    </div>
                  )}

                  {schema.common_uses && (
                    <div>
                      <h5 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">
                        Common Uses
                      </h5>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {schema.common_uses}
                      </p>
                    </div>
                  )}

                  {schema.safety_and_controversy && (
                    <div>
                      <h5 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">
                        Safety & Controversy
                      </h5>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {schema.safety_and_controversy}
                      </p>
                    </div>
                  )}

                  {schema.environmental_and_regulation && (
                    <div>
                      <h5 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">
                        Environmental Impact
                      </h5>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {schema.environmental_and_regulation}
                      </p>
                    </div>
                  )}

                  {schema.edible !== undefined && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Edible:
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          schema.edible
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {schema.edible ? "Yes" : "No"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
