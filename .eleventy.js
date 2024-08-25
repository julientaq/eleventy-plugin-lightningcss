const fs = require("node:fs");
const path = require("node:path");
const browserslist = require("browserslist");
const matter = require("gray-matter");
const {
  bundle,
  transform,
  browserslistToTargets,
  composeVisitors,
} = require("lightningcss");

// Set default transpiling targets
let browserslistTargets = "> 0.2% and not dead";

// Check for user's browserslist
try {
  const package = path.resolve(__dirname, fs.realpathSync("package.json"));
  const userPkgBrowserslist = require(package);

  if (userPkgBrowserslist.browserslist) {
    browserslistTargets = userPkgBrowserslist.browserslist;
  } else {
    try {
      const browserslistrc = path.resolve(
        __dirname,
        fs.realpathSync(".browserslistrc"),
      );

      fs.readFile(browserslistrc, "utf8", (_err, data) => {
        if (data.length) {
          browserslistTargets = [];
        }

        data.split(/\r?\n/).forEach((line) => {
          if (line.length && !line.startsWith("#")) {
            browserslistTargets.push(line);
          }
        });
      });
    } catch (err) {
      // no .browserslistrc
    }
  }
} catch (err) {
  // no package browserslist
}

module.exports = (eleventyConfig, options) => {
  console.log(eleventyConfig);
  const defaults = {
    importPrefix: "_",
    nesting: true,
    customMedia: true,
    minify: true,
    sourceMap: false,
    visitors: [],
    customAtRules: {},
    debug: false,
  };

  const {
    importPrefix,
    nesting,
    customMedia,
    minify,
    sourceMap,
    visitors,
    customAtRules,
    debug,
  } = {
    ...defaults,
    ...options,
  };

  // Recognize CSS as a "template language"
  eleventyConfig.addTemplateFormats("css");

  // Process CSS with LightningCSS
  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: async function (_inputContent, inputPath, plouf) {
      console.log("plouf", plouf);
      // log to find the content
      let parsed = path.parse(inputPath);

      console.log(parsed);
      // if the file starts with the `importPrefix`do do anything with it.
      if (parsed.name.startsWith(importPrefix)) {
        console.log(importPrefix);
        if (debug) {
          console.log(`${parsed.name} was marked as dependency`);
        }
        return;
      }

      // then let’s convert it

      // log the parsed block
      // let fileContent = matter(parsed);
      // console.log("matterized content", fileContent);
      // console.log("matter", fileContent);

      // Support @import triggering regeneration for incremental builds
      // h/t @julientaq for the fix
      console.log("matter", matter(_inputContent));
      console.log(_inputContent);

      if (_inputContent.includes("@import")) {
        // for each file create a list of files to look at
        const fileList = [];

        // get a list of import on the file your reading
        const importRuleRegex =
          /@import\s+(?:url\()?['"]?([^'"\);]+)['"]?\)?.*;/g;

        let match;
        while ((match = importRuleRegex.exec(_inputContent))) {
          fileList.push(parsed.dir + "/" + match[1]);
        }

        this.addDependencies(inputPath, fileList);
      }

      let targets = browserslistToTargets(browserslist(browserslistTargets));

      const styles = parsed.content;
      const filename = parsed.data?.permalink
        ? parsed.data.permalink
        : inputPath;

      return async () => {
        let { code } = await transform({
          filename: filename,
          // the code is a buffer from the content from gray matter
          // code: Buffer.from(styles),
          // code,
          // code,
          code: Buffer.from(_inputContent),
          minify,
          sourceMap,
          targets,
          drafts: {
            nesting,
            customMedia,
          },
          customAtRules,
          visitor: composeVisitors(visitors),
        });
        console.log(code);
        return code;
      };
    },
  });
};
