import { createApp, h } from "vue"
import { KeyboardView } from "../src/index"
import "../src/style.css"
import keyboards from "./keyboards.json"

const app = createApp({
  setup() {
    return () =>
      keyboards.map((kb) =>
        h(KeyboardView, {
          key: kb.name,
          name: kb.name,
          physKeys: kb.physKeys,
          layers: kb.layers,
        })
      )
  },
})

app.mount("#app")
