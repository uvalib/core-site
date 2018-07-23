#!/bin/bash
COMMENT=$1
cd bower_components/uvalib-theme; git commit -am"$COMMENT"; git push;
cd ../uvalib-page; git commit -am"$COMMENT"; git push;
cd ../uvalib-bookplates; git commit -am"$COMMENT"; git push;
cd ../uvalib-banner; git commit -am"$COMMENT"; git push;
cd ../..; git commit -am"$COMMENT"; git push; cd ../..;
echo "Pushed commit: $COMMENT"
