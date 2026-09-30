// Types for the `.yml` copy file, which `@rollup/plugin-yaml` loads. The shape
// is checked against the file itself, so the declaration below only needs to
// say what an import is.
declare module "*.yml" {
  const data: {
    site: { title: string; description: string };
    home: { badge: string; heading: string; intro: string; formNote: string };
    dashboard: { heading: string; subheading: string };
  };
  export default data;
}
