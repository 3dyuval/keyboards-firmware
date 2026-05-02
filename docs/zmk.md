## bindings takes positional args:

Reusable behaviors can be used by creating custom bindings
```

        sym_ht: sym_ht {
            compatible = "zmk,behavior-hold-tap";
            #binding-cells = <2>;
            tapping-term-ms = <150>;
            flavor = "balanced";
            bindings = <&mo>, <&sl>;
        };
```
This creates a reusable custom behavior `sym_ht`.
It allow use `&sym_ht` + `_` + `_` like this:

```
&sym_ht SYM SYM
```
this passes first arg `SYM` to 
- hold → &mo SYM (momentary layer while held)
and passes second arg `SYM` to 
- tap → &sl SYM (sticky/one-shot layer on tap)

Then reusing this custom behavior to use personal shortcuts/combos:
┌──────────┬──────┬─────┬─────────────────────────────────────────┐
│ behavior │ hold │ tap │              example usage              │
├──────────┼──────┼─────┼─────────────────────────────────────────┤
│ sym_ht   │ &mo  │ &sl │ &sym_ht SYM SYM                         │
├──────────┼──────┼─────┼─────────────────────────────────────────┤
│ lgui_ht  │ &kp  │ &kp │ &lgui_ht LGUI M → hold=LGUI, tap=M      │
├──────────┼──────┼─────┼─────────────────────────────────────────┤
│ mo_ht    │ &mo  │ &kp │ &mo_ht NUM HASH → hold=NUM layer, tap=# │
└──────────┴──────┴─────┴─────────────────────────────────────────┘
