#include QMK_KEYBOARD_H

// ── Layers ──────────────────────────────────────────────────────────

enum layers {
    Base,
    Sym,
    Num,
    Sys,
};

// ── Key overrides ───────────────────────────────────────────────────

const key_override_t plus_gui_override = ko_make_basic(MOD_MASK_GUI, KC_PLUS, KC_EQL);
const key_override_t *key_overrides[] = {
    &plus_gui_override,
    NULL
};

// ── Keymap ──────────────────────────────────────────────────────────
//
// KLOR polydactyl (44 keys):
//         5 top | 5 top          (no outer col)
//   tab + 5 | 5 + xxx            (outer col = pinky)
//   sft + 5 + enc | enc + 5 + sft
//   4 thumbs | 4 thumbs

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {

    // ── Base (Graphite) ─────────────────────────────────────────────
    [Base] = LAYOUT(
                 KC_B,   KC_L,   KC_D,    KC_W,    KC_Z,               KC_SCLN, KC_F,    KC_O,    KC_U,    KC_J,
        KC_TAB,  KC_N,   KC_R,   KC_T,    KC_S,    KC_G,               KC_Y,    KC_H,    KC_A,    KC_E,    KC_I,    XXXXXXX,
        KC_LSFT, KC_Q,   KC_X,   KC_M,    KC_C,    KC_V,    XXXXXXX,   XXXXXXX, KC_K,    KC_P,    KC_COMM, KC_DOT,  KC_SLSH, KC_RSFT,
                         LCTL_T(KC_ESC),  MO(Sym), KC_SPC,  KC_VOLD,   KC_VOLU, KC_ENT,  KC_BSPC, KC_LALT
    ),

    // ── Symbols ─────────────────────────────────────────────────────
    [Sym] = LAYOUT(
                 KC_AMPR, KC_LPRN, KC_RPRN, KC_EXLM, KC_QUES,           KC_COLN, KC_EQL,  KC_PLUS, KC_MINS, KC_GRV,
        MO(Num), KC_CIRC, KC_LBRC, KC_RBRC, LGUI_T(KC_DLR), KC_PERC,   KC_PGUP, KC_LEFT, KC_DOWN, KC_UP,   KC_RGHT, _______,
        _______, KC_ASTR, KC_LCBR, KC_RCBR, KC_AT,   KC_HASH, _______,  _______, KC_PGDN, KC_HOME, KC_END,  KC_QUOT, KC_BSLS, _______,
                          KC_LCTL, _______, _______, _______,            _______, KC_DEL,  _______, _______
    ),

    // ── Numbers ─────────────────────────────────────────────────────
    [Num] = LAYOUT(
                 KC_HOME, KC_PGUP, KC_PGDN, KC_END,  XXXXXXX,           XXXXXXX, KC_7,    KC_8,    KC_9,    XXXXXXX,
        _______, KC_LEFT, KC_UP,   KC_DOWN, KC_RGHT, XXXXXXX,           XXXXXXX, KC_4,    KC_5,    KC_6,    XXXXXXX, _______,
        KC_TAB,  XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, _______,  _______, KC_1,    KC_2,    KC_3,    KC_0,    XXXXXXX, _______,
                          _______, _______, _______, _______,            KC_ENT,  KC_RALT, _______, _______
    ),

    // ── System ──────────────────────────────────────────────────────
    [Sys] = LAYOUT(
                 XXXXXXX, XXXXXXX, XXXXXXX, KC_BRID, KC_BRIU,           KC_MPLY, KC_MNXT, UG_NEXT, UG_HUEU, UG_VALU,
        _______, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX,           XXXXXXX, XXXXXXX, XXXXXXX, UG_PREV, UG_HUED, UG_VALD,
        _______, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, _______,  _______, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, _______,
                          _______, _______, _______, _______,            _______, _______, _______, _______
    ),
};

// ── Combos ──────────────────────────────────────────────────────────

const uint16_t PROGMEM caps_word_combo[] = {KC_LSFT, KC_RSFT, COMBO_END};
combo_t key_combos[] = {
    COMBO(caps_word_combo, CW_TOGG),
};

// ── Hold-on-other-key-press (per key) ───────────────────────────────

bool get_hold_on_other_key_press(uint16_t keycode, keyrecord_t *record) {
    switch (keycode) {
        case LCTL_T(KC_ESC):
            return true;
        default:
            return false;
    }
}

// ── Layer RGB indicator ─────────────────────────────────────────────

layer_state_t layer_state_set_user(layer_state_t state) {
    uint8_t hue;
    switch (get_highest_layer(state)) {
        case Base: hue = 0;   break;
        case Sym:  hue = 85;  break;
        case Num:  hue = 170; break;
        case Sys:  hue = 43;  break;
        default:   hue = 0;   break;
    }
    rgb_matrix_sethsv_noeeprom(hue, rgb_matrix_get_sat(), rgb_matrix_get_val());
    return state;
}
