#include QMK_KEYBOARD_H

// ── Layers ──────────────────────────────────────────────────────────

enum layers {
    _BASE,
    _SYM,
    _NUM,
    _SYS,
};

// ── Custom keycodes (mod-morphs) ────────────────────────────────────

enum custom_keycodes {
    MM_STAR = SAFE_RANGE,  // tap=*  shift=:
    MM_SLASH,              // tap=/  shift=backslash
    MM_N3,                 // tap=3  shift=.
};

bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    if (!record->event.pressed) return true;

    uint8_t mods = get_mods() | get_oneshot_mods();
    bool shifted = mods & MOD_MASK_SHIFT;

    switch (keycode) {
        case MM_STAR:
            if (shifted) {
                del_mods(MOD_MASK_SHIFT);
                del_oneshot_mods(MOD_MASK_SHIFT);
                tap_code16(KC_COLN);
                set_mods(mods);
            } else {
                tap_code16(KC_ASTR);
            }
            return false;
        case MM_SLASH:
            if (shifted) {
                del_mods(MOD_MASK_SHIFT);
                del_oneshot_mods(MOD_MASK_SHIFT);
                tap_code(KC_BSLS);
                set_mods(mods);
            } else {
                tap_code(KC_SLSH);
            }
            return false;
        case MM_N3:
            if (shifted) {
                del_mods(MOD_MASK_SHIFT);
                del_oneshot_mods(MOD_MASK_SHIFT);
                tap_code(KC_DOT);
                set_mods(mods);
            } else {
                tap_code(KC_3);
            }
            return false;
    }
    return true;
}

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
    [_BASE] = LAYOUT(
        KC_F1,          KC_F2,   KC_F3,   KC_F4,   KC_F5,   KC_F6,             KC_F7,   KC_F8,   KC_F9,   KC_F10,  KC_F11,  KC_F12,
        KC_NO,          LT(_SYS,KC_B), KC_L, KC_D,  KC_W,    KC_Z,             KC_SCLN, KC_F,    KC_O,    KC_U,    KC_J,    KC_RSFT,
        KC_CAPS,        KC_N,    KC_R,    KC_T,    KC_S,    KC_G,              KC_Y,    KC_H,    KC_A,    KC_E,    KC_I,    KC_QUOT,
        TD_LSFT,        KC_Q,    KC_X,    KC_M,    KC_C,    KC_V,    KC_NO,    KC_NO,   KC_K,    KC_P,    KC_COMM, KC_DOT,  KC_SLSH, KC_RSFT,
                                          LCTL_T(KC_ESC), MO(_SYM),KC_SPC,    KC_ENT,  KC_BSPC, KC_LALT
    ),

    // ── Symbols ─────────────────────────────────────────────────────
    [_SYM] = LAYOUT(
        _______, _______, _______, _______, _______, _______,                   _______, _______, _______, _______, _______, _______,
        _______, KC_EXLM, KC_LPRN, KC_RPRN, KC_AMPR, KC_GRV,                   KC_COLN, KC_EQL,  KC_MINS, KC_PLUS, KC_UNDS, _______,
        _______, KC_ASTR, KC_LBRC, KC_RBRC, KC_DLR,  KC_HASH,                  KC_PGUP, KC_LEFT, KC_DOWN, KC_UP,   KC_RGHT, _______,
        _______, KC_CIRC, KC_LCBR, KC_RCBR, KC_AT,  LT(_NUM,KC_PERC), KC_NO, KC_NO, KC_PGDN, KC_HOME, KC_END, KC_QUOT, KC_BSLS, _______,
                                   KC_LCTL, _______, _______,                  _______, KC_DEL,  _______
    ),

    // ── Numbers ─────────────────────────────────────────────────────
    [_NUM] = LAYOUT(
        KC_F1,   KC_F2,   KC_F3,   KC_F4,   KC_F5,   KC_F6,                    KC_F7,   KC_F8,   KC_F9,   KC_F10,  KC_F11,  KC_F12,
        _______, KC_HOME, KC_PGUP, KC_PGDN, KC_END,  _______,                  MM_STAR, KC_7,    KC_8,    KC_9,    KC_MINS, _______,
        _______, KC_LEFT, KC_UP,   KC_DOWN, KC_RGHT, _______,                  KC_EQL,  KC_4,    KC_5,    KC_6,    KC_PLUS, _______,
        KC_TAB,  _______, _______, _______, _______, _______, KC_NO,  KC_NO,   MM_SLASH,KC_1,    KC_2,    MM_N3,   KC_0,    _______,
                                   _______, _______, _______,                  KC_ENT,  KC_RALT, _______
    ),

    // ── System / Device ─────────────────────────────────────────────
    [_SYS] = LAYOUT(
        _______, _______, KC_NO,   KC_BRID, KC_BRIU, KC_MPLY,                  KC_MNXT, KC_VOLU, KC_VOLD, UG_NEXT, UG_HUEU, UG_VALU,
        _______, _______, _______, _______, _______, _______,                  _______, _______, _______, UG_PREV, UG_HUED, UG_VALD,
        _______, _______, _______, _______, _______, _______,                  _______, _______, _______, _______, _______, _______,
        _______, _______, _______, _______, _______, _______, KC_NO,  KC_NO,   _______, _______, KC_NO,   KC_NO,   KC_NO,   KC_NO,
                                   _______, _______, _______,                  _______, _______, _______
    ),
};

// ── Hold-on-other-key-press (per key) ───────────────────────────────
// LGUI_T(KC_AT) should trigger hold (LGUI) as soon as another key is
// pressed while it is held, matching ZMK "balanced" flavor.

bool get_hold_on_other_key_press(uint16_t keycode, keyrecord_t *record) {
    switch (keycode) {
        case LCTL_T(KC_ESC):
        case LT(_NUM, KC_PERC):
            return true;
        default:
            return false;
    }
}

// ── Layer RGB indicator ─────────────────────────────────────────────

layer_state_t layer_state_set_user(layer_state_t state) {
    uint8_t hue;
    switch (get_highest_layer(state)) {
        case _BASE: hue = 0;   break;  // Red
        case _SYM:  hue = 85;  break;  // Green
        case _NUM:  hue = 170; break;  // Blue
        case _SYS:  hue = 43;  break;  // Yellow
        default:    hue = 0;   break;
    }

    rgb_matrix_sethsv_noeeprom(hue, rgb_matrix_get_sat(), rgb_matrix_get_val());
    return state;
}
