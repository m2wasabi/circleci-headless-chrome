mkdir "$CIRCLE_ARTIFACTS/diff"
blink-diff --output "$CIRCLE_ARTIFACTS/diff/$1"  "$CIRCLE_ARTIFACTS/previous/$1"  "$CIRCLE_ARTIFACTS/$1"