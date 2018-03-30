#!/bin/bash
wget https://drupal.lib.virginia.edu/rest/files -OrawAPI/rest/files
wget https://drupal.lib.virginia.edu/pages -OrawAPI/pages
wget https://drupal.lib.virginia.edu/blocks -OrawAPI/blocks
wget https://drupal.lib.virginia.edu/rest/resource_cards -OrawAPI/rest/resource_cards
wget https://drupal.lib.virginia.edu/rest/stages -OrawAPI/rest/stages
rsync -avh -e 'ssh -i $HOME/.ssh/id_rsa' rawAPI/ www14.lib.virginia.edu:/wwwstatic/rawAPI;
