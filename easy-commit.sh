#!/bin/bash
COMMENT=$1
cd bower_components/uvalib-theme; git commit -am"$COMMENT"; git push; cd ../..;
cd ../..; git commit -am"$COMMENT"; git push; cd ../..;
echo "Pushed commit: $COMMENT"
