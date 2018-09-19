const IN = 'IN', OUT = 'OUT', INOUT = 'INOUT'

const processDefinitions = {
	"com.tibco.plugin.jms.JMSQueueEventSource": {
		direction: IN
	},
	"com.tibco.plugin.jms.JMSQueueRequestReplyActivity": {
		direction: INOUT
	},
	"com.tibco.plugin.jms.JMSQueueSendActivity": {
		direction: OUT
	},
	"com.tibco.plugin.jms.JMSQueueGetMessageActivity": {
		direction: IN
	},
	"com.tibco.plugin.jms.JMSReplyActivity": {
		direction: OUT
	},
	"com.tibco.plugin.jms.JMSQueueSignalInActivity": {
		direction: IN
	},
	"com.tibco.plugin.jms.JMSTopicEventSource": {
		direction: IN
	},
	"com.tibco.plugin.jms.JMSTopicPublishActivity": {
		direction: OUT
	},
	"com.tibco.plugin.jms.JMSTopicRequestReplyActivity": {
		direction: INOUT
	},
	"com.tibco.plugin.jms.JMSTopicSignalInActivity": {
		direction: IN
	},
	"com.tibco.plugin.soap.SOAPEventSource": {
		direction: IN
	},
	"com.tibco.plugin.soap.SOAPSendReceiveActivity": {
		direction: INOUT
	},
	"com.tibco.plugin.soap.SOAPSendFaultActivity": {
		direction: OUT
	},
	"com.tibco.plugin.soap.SOAPSendReplyActivity": {
		direction: IN
	}
}
const processDefinitionsEnum = Object.keys(processDefinitions)

module.exports = { processDefinitions, processDefinitionsEnum }
