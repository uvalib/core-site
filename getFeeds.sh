#!/bin/bash
wget https://drupal.lib.virginia.edu/rest/files?_format=json -OrawAPI/rest/files
wget https://drupal.lib.virginia.edu/pages?_format=json -OrawAPI/pages
wget https://drupal.lib.virginia.edu/blocks?_format=json -OrawAPI/blocks
wget https://drupal.lib.virginia.edu/rest/resource_cards?_format=json -OrawAPI/rest/resource_cards
wget https://drupal.lib.virginia.edu/rest/stages?_format=json -OrawAPI/rest/stages
rsync -avh -e 'ssh -i $HOME/.ssh/id_rsa' rawAPI/ www14.lib.virginia.edu:/wwwstatic/rawAPI;
