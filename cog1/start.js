require(["dojo", "dojo/parser", "dojo/domReady!"], function (dojo) {
  "use strict";

  require({
    async: true,
    parseOnLoad: true,
    debug: true,
    cacheBust: new Date(),
    waitSeconds: 5,
    paths: {
      "cog1": "/cog1",
    },
    aliases: [
      ["app", "cog1/app"],
      ["layout", "cog1/layout"],
      ["ui", "cog1/ui"],
      ["scene", "cog1/scene"],
      ["scenegraph", "cog1/scenegraph"],
      ["createScene", "cog1/createScene"],
      ["model", "cog1/model"],
      ["node", "cog1/node"],
      ["raster", "cog1/raster"],
      ["shader", "cog1/shader"],
      ["framebuffer", "cog1/framebuffer"],
      ["texture", "cog1/texture"],
      ["animation", "cog1/animation"],
      ["data", "cog1/data"],
      ["glMatrix", "cog1/ext/glMatrix.js"]
    ]
  });

  require(["app"], function (app) {
    app.load();
  });
});
