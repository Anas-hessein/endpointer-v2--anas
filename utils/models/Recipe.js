import mongoose from "mongoose";

const RecipeSchema = new mongoose.Schema({
  title: String,
  ingredients: [String],
  instructions: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});

export default mongoose.models.Recipe || mongoose.model("Recipe", RecipeSchema);
