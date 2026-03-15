export const wadaAdakshyaData = {
  "Kathmandu Metropolitan City - 1": {
    name: "Bharat Lal Shrestha",
    contact: "98510XXXXX",
    office: "Naxal, Kathmandu",
    email: "ward1@kathmandu.gov.np"
  },
  "Kathmandu Metropolitan City - 2": {
    name: "Bijay Kumar Shrestha",
    contact: "98412XXXXX",
    office: "Lazimpat, Kathmandu",
    email: "ward2@kathmandu.gov.np"
  },
  "Lalitpur Metropolitan City - 1": {
    name: "Nirmal Tandukar",
    contact: "98511XXXXX",
    office: "Kupandole, Lalitpur",
    email: "ward1@lalitpur.gov.np"
  },
  "Byas Rural Municipality - 1": {
    name: "Ashok Singh Bohara",
    contact: "9868XXXXXX",
    office: "Sunsera, Darchula",
    email: "ward1@byasmun.gov.np",
    note: "This ward includes the Lipulekh area."
  },

  "Default": {
    name: "Information not available",
    contact: "Please contact local municipality",
    office: "Municipal Office",
    email: "info@localgov.np"
  }
};

export const findWadaAdakshya = (wardName) => {
  return wadaAdakshyaData[wardName] || wadaAdakshyaData["Default"];
};