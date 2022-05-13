import express from "express";
import cors from "cors";

const app = express();

app.use(cors());

app.get("/get", (req, resp) => {
    const episodes = ["Lorem ipsum dolor sit amet con sectetur adipisicing elit. Maiores nihil facilis dolores ipsam blanditiis dicta.", "Dolorem repellendus impedit aliquam!"];
    resp.send(JSON.stringify(episodes));
});

app.post("/submit", (req, resp) => {

})

app.listen(80, () => console.log("Listening"));
