function ArrCount(arr, item){
      var i = 0;
      arr.forEach(function(ele){
        ele === item ? i++ : ''; 
      })
      return i;
}

module.exports = {
    ArrCount
};