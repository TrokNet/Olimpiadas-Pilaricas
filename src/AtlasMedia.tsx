import type { Delegation } from "./delegationData";
const imageUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
export default function DelegationImage({
  item,
  illustration = false,
  eager = false,
}: {
  item: Delegation;
  illustration?: boolean;
  eager?: boolean;
}) {
  const photo = !illustration && item.photo;
  return (
    <img
      src={imageUrl(photo ? photo.image : item.illustration)}
      alt={
        photo
          ? photo.place
          : `Ilustración editorial de ${item.grade.id === "ex-alumnas" ? "la comunidad de exalumnas" : item.placeName}`
      }
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      width={1000}
      height={700}
    />
  );
}
