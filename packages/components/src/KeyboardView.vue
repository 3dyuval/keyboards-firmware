<script setup lang="ts">
import { ref, computed } from "vue"

export interface PhysKey { x: number; y: number; w: number; h: number; r: number }
export interface KeyEntry { t?: string; h?: string }
export type KeyValue = string | KeyEntry

const pad = 4
const gap = 4

const props = defineProps<{
  name: string
  physKeys: PhysKey[]
  layers: Record<string, KeyValue[]>
}>()

const layerNames = computed(() => Object.keys(props.layers))
const activeLayer = ref(layerNames.value[0] ?? "")

const selected = ref<Set<number>>(new Set())

function toggleKey(i: number) {
  if (selected.value.has(i)) {
    selected.value.delete(i)
  } else {
    selected.value.add(i)
  }
  selected.value = new Set(selected.value)
}

function keyLabel(entry: KeyValue | undefined): { tap: string; hold: string } {
  if (!entry) return { tap: "", hold: "" }
  if (typeof entry === "string") return { tap: entry, hold: "" }
  return { tap: (entry.t === "\u25bd" ? "" : entry.t) ?? "", hold: entry.h ?? "" }
}

const bounds = computed(() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const k of props.physKeys) {
    minX = Math.min(minX, k.x)
    minY = Math.min(minY, k.y)
    maxX = Math.max(maxX, k.x + k.w)
    maxY = Math.max(maxY, k.y + k.h)
  }
  return { minX, minY, maxX, maxY }
})

const bw = computed(() => bounds.value.maxX - bounds.value.minX + pad * 2)
const bh = computed(() => bounds.value.maxY - bounds.value.minY + pad * 2)

function pctX(v: number) { return (v / bw.value * 100) + "%" }
function pctY(v: number) { return (v / bh.value * 100) + "%" }

const currentKeys = computed(() => props.layers[activeLayer.value] ?? [])
</script>

<template>
  <section>
    <h2>{{ name }}</h2>
    <div class="tabs">
      <button
        v-for="layer in layerNames"
        :key="layer"
        class="tab"
        :class="{ active: layer === activeLayer }"
        @click="activeLayer = layer"
      >{{ layer }}</button>
    </div>
    <div class="keyboard" :style="{ aspectRatio: bw / bh }">
      <button
        v-for="(pk, i) in physKeys"
        :key="i"
        class="key"
        :class="{
          held: !!keyLabel(currentKeys[i]).hold,
          selected: selected.has(i),
        }"
        :style="{
          left: pctX(pk.x - bounds.minX + pad),
          top: pctY(pk.y - bounds.minY + pad),
          width: pctX(pk.w - gap),
          height: pctY(pk.h - gap),
          transform: pk.r ? `rotate(${pk.r}deg)` : undefined,
        }"
        @click="toggleKey(i)"
      >
        <span class="tap">{{ keyLabel(currentKeys[i]).tap }}</span>
        <span v-if="keyLabel(currentKeys[i]).hold" class="hold">{{ keyLabel(currentKeys[i]).hold }}</span>
      </button>
    </div>
  </section>
</template>
