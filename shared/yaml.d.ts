// Types for the `.yml` copy file, which `@rollup/plugin-yaml` loads. The shape
// is written by hand: `shared/copy.test.ts` fails when `content/copy.yml` and this
// declaration's keys drift apart, so change both and that test together.
declare module "*.yml" {
  const data: {
    site: { title: string; description: string };
    home: { badge: string; heading: string; intro: string; formNote: string };
    dashboard: { heading: string; subheading: string };
  };
  export default data;
}
