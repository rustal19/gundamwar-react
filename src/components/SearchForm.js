import React, { useState } from "react";

const SearchForm = ({ onSearch }) => {
  const [name, setName] = useState("");
  const [cardType, setCardType] = useState("");
  const [cost, setCost] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({ name, cardType, cost });
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "1em" }}>
      <input
        type="text"
        placeholder="カード名"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <select
        value={cardType}
        onChange={(e) => setCardType(e.target.value)}
        style={{ marginLeft: "1em" }}
      >
        <option value="">全てのタイプ</option>
        <option value="UNIT">UNIT</option>
        <option value="COMMAND">COMMAND</option>
        <option value="OPERATION">OPERATION</option>
      </select>

      <input
        type="number"
        placeholder="コスト"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        style={{ marginLeft: "1em" }}
      />

      <button type="submit" style={{ marginLeft: "1em" }}>
        検索
      </button>
    </form>
  );
};

export default SearchForm;
