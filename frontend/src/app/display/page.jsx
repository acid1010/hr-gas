import dynamic from "next/dynamic";

const DisplayInner = dynamic(() => import("./DisplayInner"), { ssr: false });

export default function DisplayPage() {
  return <DisplayInner />;
}
