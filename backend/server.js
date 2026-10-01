import express from "express";
import getBucket from "./util/getBucket.js";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(getBucket);

app.get("/", (req, res) => {
  res.send("Hello, request allowed!");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});