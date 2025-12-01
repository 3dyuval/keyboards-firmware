  layer_state_t layer_state_set_user(layer_state_t state) {
      switch (get_highest_layer(state)) {
          case 0: rgb_matrix_sethsv_noeeprom(0, 255, 255);   break;  // Red
          case 1: rgb_matrix_sethsv_noeeprom(85, 255, 255);  break;  // Green
          case 2: rgb_matrix_sethsv_noeeprom(170, 255, 255); break;  // Blue
          case 3: rgb_matrix_sethsv_noeeprom(43, 255, 255);  break;  // Yellow
      }
      return state;
  }
