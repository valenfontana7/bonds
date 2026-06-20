export function mountHandler(app, path, handler) {
  app.all(path, (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  });
}
