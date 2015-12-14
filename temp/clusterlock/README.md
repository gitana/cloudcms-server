# ClusterLock

This module provides simple lock mechanics that work across multiple process workers in a cluster.  The cluster master
instantiates an "rwlock" (Alberto La Rocca) and the callbacks send messages back to the target slave workers to run their
queued callbacks.  When callbacks complete, they release which fires back to master and advances the master queue.

