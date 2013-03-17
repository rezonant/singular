module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jasmine: {
      src: [
        'components/jquery/jquery.js',
        'js/singular.js'
      ],

      options: {
        specs: 'tests/**/*.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jasmine');

  // Default task(s).
  grunt.registerTask('default', ['jasmine']);

};
