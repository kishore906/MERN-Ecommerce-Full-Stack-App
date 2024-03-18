import { Helmet } from "react-helmet";

const MetaData = ({ title }) => {
  return (
    <Helmet>
      <title>{`${title} - GloboMart`}</title>
    </Helmet>
  );
};

export default MetaData;
