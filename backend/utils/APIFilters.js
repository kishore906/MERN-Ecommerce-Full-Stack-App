class APIFilters {
  constructor(query, queryStr) {
    this.query = query; // query is 'Product' model
    this.queryStr = queryStr;
  }

  search() {
    // checking if 'keyword' exists in the queryString(req.query)
    const keyword = this.queryStr.keyword
      ? {
          // search in the product with 'name' property
          name: {
            // the product search will happen based on the keyword but here we writing the search word in regex
            // because we are trying to find in 'group of words' that matches search word -> 'group of words' can be single word or more
            // and $regex will help in searching in the name property of the product with keyword value, and not exactly matching the keyword(single word) the 'name' property
            // $regex, $options are mongoose operators (always starts with '$' symbol)
            $regex: this.queryStr.keyword,
            $options: "i", // means case insensitive
          },
        }
      : {};

    //console.log(keyword); // { name: { '$regex': 'apple', '$options': 'i' } }

    this.query = this.query.find({ ...keyword });

    //console.log(this);

    return this;
  }

  // function to handle single query strings => /api/products?category=Electronics
  filters() {
    const queryCopy = { ...this.queryStr }; // for /api/products?keyword=apple&category=Electronics => { keyword: 'apple', category: 'electronics'}

    // Fields to remove after initial keyword search(above)
    const fieldsToremove = ["keyword", "page"];
    fieldsToremove.forEach((el) => delete queryCopy[el]);

    // advance filter for price, ratings etc
    /* 
    // console.log(queryCopy); // for /api/products?category=Electronics => { category: 'electronics'}

    url => /api/products?price[gte]=100
      -> we are trying to get products whose price is greater than or equal to(gte) 100
      console.log(queryCopy); // { price: { gte: '100' } }
      
      // mongoose operators
      gt ->  greater than
      gte -> greater than or equal to
      lt -> less than
      lte -> less than or equal to

      \b -> ensures that matches the entire word
      /g -> global 
    */
    let queryStr = JSON.stringify(queryCopy);
    // here we trying to add $ before gt || gte || lt || lte because mongoose operator must start with $
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);
    //console.log(queryStr); // { 'price': { '$gte': '100' } }
    // {"price":{"$gte":"100","$lte":"300"}} -> if you are trying to find products b/w two values

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  // Pagination
  pagination(resPerPage) {
    const currentPage = this.queryStr.page || 1; // we pass 'page' value in req.query
    // resPerPage * (currentPage - 1) gives us noOfProducts we want to skip when we r not on the first page
    // for eg: if we r at page = 2 then 4 * (2 - 1) = 4 (so we need to skip first 4 products)
    const skip = resPerPage * (currentPage - 1);

    // 'limit' & 'skip' methods are provided by the mongoose
    this.query = this.query.limit(resPerPage).skip(skip);
    return this;
  }
}

export default APIFilters;
