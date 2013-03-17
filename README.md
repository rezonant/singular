# Singular

Singular is a simple HTML5 data binding layer. It provides direct access to the models, so you can put in your data in any way you see fit, not just
using Singular's controllers API!

For full documentation and demo, visit http://slvr.tv/opensource/singular/ or check out this repository.

# Using Singular in your own project

You do not have to prepare the sources if you simply wish to use Singular in your own project. The simplest way to
use Singular is to copy the singular.js and singular.css files into your project and include them. You will need to
include jQuery before Singular. You can then use $(selector).singular() to run the Singular binding engine on a 
set of elements.

Note that this package does not provide for minification at all. You should instead integrate Singular into your own
production build step so that the internals of Singular are available for debugging while you build your app.

# Preparing the Sources

This step is only needed if:

 * You wish to run the Singular demos locally,
 * You wish to run the Jasmine unit tests
 * You wish to contribute to the Singular codebase

Usually the first two goals can be better accomplished by browsing the [Singular website](http://slvr.tv/opensource/singular) 
(which is a deployment of this repository).

To begin, you will need to have NodeJS 0.8+, NPM, Grunt, and Bower installed before you can begin. 

To install NodeJS and NPM on Debian systems (ie Ubuntu, Mint):

    sudo apt-get install nodejs npm
    nodejs -v # make sure you have 0.8 or later

Now use npm to install grunt-cli and bower globally

    sudo npm install -g grunt-cli bower

Navigate to the singular package root and:

    npm install && bower install

The package should now operate correctly as a complete HTML 5 application.
