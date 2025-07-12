module.exports = (query, { page, pageSize }) => {
    page = page ? page : 0;
    pageSize = pageSize ? pageSize : 10;
    const offset = parseInt(page * pageSize);
    const limit = parseInt(pageSize);
  
    return {
      ...query,
      offset,
      limit,
    };
  };
  