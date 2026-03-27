#include QMK_KEYBOARD_H

// ── Layers ──────────────────────────────────────────────────────────

enum layers {
    Base,
    Sym,
    Num,
    Sys,
};

// ── Tap dance ───────────────────────────────────────────────────────

enum {
    TD_LSHIFT_TAB,
};

tap_dance_action_t tap_dance_actions[] = {
    [TD_LSHIFT_TAB] = ACTION_TAP_DANCE_DOUBLE(KC_LSFT, KC_TAB),
};

#define TD_LSFT TD(TD_LSHIFT_TAB)

// ── Key overrides ───────────────────────────────────────────────────

const key_override_t plus_gui_override = ko_make_basic(MOD_MASK_GUI, KC_PLUS, KC_EQL);
const key_override_t *key_overrides[] = {
    &plus_gui_override,
    NULL
};

// ── Keymap ──────────────────────────────────────────────────────────
//
// Iris layout (56 keys):
//   12 number row  +  12 row1  +  12 row2  +  14 row3 (inc. 2 inner)  +  6 thumb

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {

    // ── Base (Graphite) ─────────────────────────────────────────────
    [Base] = LAYOUT(
        KC_F1,          KC_F2,   KC_F3,   KC_F4,   KC_F5,   KC_F6,             KC_F7,   KC_F8,   KC_F9,   KC_F10,  KC_F11,  KC_F12,
        MO(Num),        LT(Sys,KC_B), KC_L, KC_D,  KC_W,    KC_Z,             KC_SCLN, KC_F,    KC_O,    KC_U,    KC_J,    KC_RSFT,
        KC_LGUI,        KC_N,    KC_R,    KC_T,    KC_S,    KC_G,              KC_Y,    KC_H,    KC_A,    KC_E,    KC_I,    KC_NO,
        TD_LSFT,        KC_Q,    KC_X,    KC_M,    KC_C,    KC_V,    KC_VOLD,  KC_VOLU, KC_K,    KC_P,    KC_COMM, KC_DOT,  KC_SLSH, KC_RSFT,
                                          LCTL_T(KC_ESC), MO(Sym),KC_SPC,    KC_ENT,  KC_BSPC, KC_LALT
    ),

    // ── Symbols ─────────────────────────────────────────────────────
    // TODO: find QMK-compatible hold behavior for SYM+C (LGUI) and SYM+V (NUM layer)
    [Sym] = LAYOUT(
        _______, _______, _______, _______, _______, _______,                   _______, _______, _______, _______, _______, _______,
        _______, KC_AMPR, KC_LPRN, KC_RPRN, KC_EXLM, KC_QUES,                  KC_COLN, KC_EQL,  KC_PLUS, KC_MINS, KC_GRV,  _______,
        _______, KC_CIRC, KC_LBRC, KC_RBRC, KC_DLR,  KC_PERC,                  KC_PGUP, KC_LEFT, KC_DOWN, KC_UP,   KC_RGHT, _______,
        _______, KC_ASTR, KC_LCBR, KC_RCBR, KC_AT,   KC_HASH, _______, _______, KC_PGDN, KC_HOME, KC_END, KC_QUOT, KC_BSLS, _______,
                                   KC_LCTL, _______, _______,                  _______, KC_DEL,  _______
    ),

    // ── Numbers ─────────────────────────────────────────────────────
    [Num] = LAYOUT(
        KC_F1,   KC_F2,   KC_F3,   KC_F4,   KC_F5,   KC_F6,                    KC_F7,   KC_F8,   KC_F9,   KC_F10,  KC_F11,  KC_F12,
        _______, KC_HOME, KC_PGUP, KC_PGDN, KC_END,  _______,                  _______, KC_7,    KC_8,    KC_9,    _______, _______,
        _______, KC_LEFT, KC_UP,   KC_DOWN, KC_RGHT, _______,                  _______, KC_4,    KC_5,    KC_6,    _______, _______,
        KC_TAB,  _______, _______, _______, _______, _______, _______, _______,  _______, KC_1,    KC_2,    KC_3,    KC_0,    _______,
                                   _______, _______, _______,                  _______, _______, _______
    ),

    // ── System / Device ─────────────────────────────────────────────
    [Sys] = LAYOUT(
        _______, _______, KC_NO,   KC_BRID, KC_BRIU, KC_MPLY,                  KC_MNXT, KC_VOLU, KC_VOLD, UG_NEXT, UG_HUEU, UG_VALU,
        _______, _______, _______, _______, _______, _______,                  _______, _______, _______, UG_PREV, UG_HUED, UG_VALD,
        _______, _______, _______, _______, _______, _______,                  _______, _______, _______, _______, _______, _______,
        _______, _______, _______, _______, _______, _______, _______, _______,  _______, _______, KC_NO,   KC_NO,   KC_NO,   KC_NO,
                                   _______, _______, _______,                  _______, _______, _______
    ),
};

// ── Combos ──────────────────────────────────────────────────────────

const uint16_t PROGMEM caps_word_combo[] = {TD_LSFT, KC_RSFT, COMBO_END};
combo_t key_combos[] = {
    COMBO(caps_word_combo, CAPS_WORD),
};

// ── Hold-on-other-key-press (per key) ───────────────────────────────
// LGUI_T(KC_AT) should trigger hold (LGUI) as soon as another key is
// pressed while it is held, matching ZMK "balanced" flavor.

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
        case Base: hue = 0;   break;  // Red
        case Sym:  hue = 85;  break;  // Green
        case Num:  hue = 170; break;  // Blue
        case Sys:  hue = 43;  break;  // Yellow
        default:    hue = 0;   break;
    }

    rgb_matrix_sethsv_noeeprom(hue, rgb_matrix_get_sat(), rgb_matrix_get_val());
    return state;
}
