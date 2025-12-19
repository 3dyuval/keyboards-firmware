#include QMK_KEYBOARD_H

// GUI + PLUS sends GUI + = (not GUI + SHIFT + =)
const key_override_t plus_gui_override = ko_make_basic(MOD_MASK_GUI, KC_PLUS, KC_EQL);
const key_override_t *key_overrides[] = {
    &plus_gui_override,
    NULL
};

layer_state_t layer_state_set_user(layer_state_t state) {
    uint8_t hue;
    switch (get_highest_layer(state)) {
        case 0: hue = 0;   break;  // Red
        case 1: hue = 85;  break;  // Green
        case 2: hue = 170; break;  // Blue
        case 3: hue = 43;  break;  // Yellow
        default: hue = 0;  break;
    }

    rgb_matrix_sethsv_noeeprom(hue, rgb_matrix_get_sat(), rgb_matrix_get_val());
    return state;
}
