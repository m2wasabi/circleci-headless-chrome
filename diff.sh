mkdir -p "$CIRCLE_ARTIFACTS/diff"
blink-diff --compose-ltr --hide-shift --h-shift $2 --v-shift $2 --threshold-type $3 --threshold $4 --output "$CIRCLE_ARTIFACTS/diff/$1"  "$CIRCLE_ARTIFACTS/previous/$1"  "$CIRCLE_ARTIFACTS/current/$1"