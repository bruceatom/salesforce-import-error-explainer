// Creates and converts one lead so the lab can try updating a converted lead.
Lead l = new Lead(LastName = 'Lab Converted', Company = 'Lab Co');
insert l;
Database.LeadConvert lc = new Database.LeadConvert();
lc.setLeadId(l.Id);
LeadStatus converted = [SELECT MasterLabel FROM LeadStatus WHERE IsConverted = true LIMIT 1];
lc.setConvertedStatus(converted.MasterLabel);
lc.setDoNotCreateOpportunity(true);
Database.convertLead(lc);
