import { mount } from "svelte";
import App from "./App.svelte";
import "./styles/app.css";
import "./styles/markdown.css";
import "./styles/mermaid.css";

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app mount target");

mount(App, { target });
