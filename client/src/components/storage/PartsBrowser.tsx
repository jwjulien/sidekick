import UniversalPartsBrowser from "../parts/UniversalPartsBrowser";

export default function PartsBrowser(props: {
  parts?: any[];
  locationId?: string;
  onSelectPart: (part: any) => void;
  onAutoSelect?: (part: any) => void;
}) {
  return (
    <UniversalPartsBrowser
      parts={props.parts}
      locationId={props.locationId}
      title="Aggregated Parts Browser"
      onSelectPart={props.onSelectPart}
      onAutoSelect={props.onAutoSelect}
      mode="table"
    />
  );
}
