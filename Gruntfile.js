module.exports = function(grunt) {

  "use strict";

  // Initializes the Grunt tasks with the following settings
  grunt.initConfig({

    // A list of files which will be syntax-checked by JSHint.
    jshint: {
      files: ['src/js/shims.js', 'src/js/firechat.js', 'src/js/man2manchat-ui.js'],
      options: {
        regexdash: false
      }
    },

    // Precompile templates and strip whitespace with 'processContent'.
    jst: {
      compile: {
        options: {
          path: 'templates',
          namespace: 'FirechatDefaultTemplates',
          prettify: true,
          processContent: function(src) {
            return src.replace(/(^\s+|\s+$)/gm, '');
          }
        },
        files: {
          'compiled/templates.js': ['templates/*.html']
        }
      }
    },

    // Compile and minify LESS CSS for production.
    less: {
      development: {
        files: {
          "dist/firechat.css": "src/less/styles.less",
          "dist/man2manchat.css": "src/less/chat.less"
        }
      },
      production: {
        options: {
          yuicompress: true
        },
        files: {
          "dist/firechat.min.css": "src/less/styles.less",
          "dist/man2manchat.css": "src/less/chat.less"
        }
      }
    },

    // Concatenate files in a specific order.
    concat: {
      js: {
        src: [
          'src/js/libs/underscore-1.7.0.min.js',
          'src/js/libs/damgate.js',
          'src/js/libs/dropzone.js',
          'compiled/templates.js',
          'src/js/shims.js',
          'src/js/firechat.js',
          'src/js/man2manchat-ui.js'
        ],
        dest: 'dist/man2manchat.js'
      }
    },

    // Minify concatenated files.
    uglify: {
      'dist/man2manchat.min.js': ['dist/man2manchat.js'],
    },

    // Clean up temporary files.
    clean: ['compiled/'],

    // Tasks to execute upon file change when using `grunt watch`.
    watch: {
      src: {
        files: ['src/**/*.*', 'templates/**/*.*'],
        tasks: ['default']
      }
    }
  });

  // Load specific plugins, which have been installed and specified in package.json.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-jst');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task operations if simply calling `grunt` without options.
  grunt.registerTask('default', ['jshint', 'jst', 'less', 'concat', 'uglify', 'clean']);

};
